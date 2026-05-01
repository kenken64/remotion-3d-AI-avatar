import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import OpenAI, {toFile} from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({limit: '10mb'}));

// Tailscale funnel strips the /api path prefix before forwarding here.
// Re-add it so the routes below match in both cases.
app.use((req, _res, next) => {
  if (!req.path.startsWith('/api')) {
    req.url = '/api' + req.url;
  }
  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chat goes directly to ttyproxy's Ollama-compatible endpoint, bypassing
// OpenClaw to avoid ~30s of per-turn agent prep. ttyproxy fronts Claude Code
// CLI, so the model id matches what `openclaw plugins` exposes for ollama.
// chatClient is kept for the optional VISION_USE_OPENCLAW path below.
const chatClient = new OpenAI({
  baseURL: process.env.CHAT_BASE_URL || 'http://127.0.0.1:18789/v1',
  apiKey: process.env.CHAT_API_KEY || process.env.OPENAI_API_KEY,
});
const TTYPROXY_BASE_URL = process.env.TTYPROXY_BASE_URL || 'http://127.0.0.1:11435';
const CHAT_MODEL = process.env.CHAT_MODEL || 'claude-code:latest';

type ChatMsg = {role: string; content: string};

async function ollamaChat(messages: ChatMsg[]): Promise<string> {
  const res = await fetch(`${TTYPROXY_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({model: CHAT_MODEL, messages, stream: false}),
  });
  if (!res.ok) {
    throw new Error(`ttyproxy ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const data = (await res.json()) as {message?: {content?: string}};
  return data?.message?.content ?? '';
}

// Detect if text contains Chinese characters
function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

// Heuristic: does this user message look like an image-generation request?
function isImageRequest(text: string): boolean {
  const t = text.toLowerCase();
  // English: "send/show/generate/draw/create/make/give me a picture/image/photo of ..."
  if (/\b(send|show|generate|draw|create|make|give|paint|sketch)\b[^.?!]*\b(picture|image|photo|pic|photograph|drawing|painting|sketch|illustration)\b/.test(t)) return true;
  if (/\b(picture|image|photo|drawing|illustration)\s+of\b/.test(t)) return true;
  // Chinese: \u753b / \u751f\u6210\u56fe / \u4e00\u5f20\u56fe etc.
  if (/(\u753b\u4e00[\u5f20\u5e45]|\u751f\u6210.*\u56fe|\u53d1.*\u56fe\u7247|\u6765\u4e00\u5f20.*\u56fe)/.test(text)) return true;
  return false;
}

async function generateImage(prompt: string): Promise<string | null> {
  try {
    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1024x1024',
      n: 1,
    });
    return result.data?.[0]?.url || null;
  } catch (err: any) {
    console.error('Image gen error:', err.message);
    return null;
  }
}

// Chat completions
app.post('/api/chat', async (req, res) => {
  try {
    const {messages} = req.body;

    // Detect language from the latest user message
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const userText = lastUserMsg?.content || '';
    const isChinese = hasChinese(userText);

    const languageInstruction = isChinese
      ? 'The user is speaking Chinese. You MUST reply in Chinese (Simplified Mandarin). Do not reply in English.'
      : 'The user is speaking English. You MUST reply in English. Do not reply in Chinese.';

    const wantsImage = isImageRequest(userText);

    const [replyText, imageUrl] = await Promise.all([
      ollamaChat([
        {
          role: 'system',
          content:
            `You are kenken64, a friendly, witty AI avatar assistant. Keep your responses concise — 1 to 3 sentences maximum, since your words will be spoken aloud. Be conversational and natural.${wantsImage ? ' The user is asking for an image; one is being generated for them, so briefly acknowledge it (e.g. "Here you go!") in your reply.' : ''} ${languageInstruction}`,
        },
        ...messages,
      ]),
      wantsImage ? generateImage(userText) : Promise.resolve(null),
    ]);

    const reply = replyText || (isChinese ? '我不确定该说什么。' : "I'm not sure what to say.");
    res.json({reply, imageUrl: imageUrl || undefined});
  } catch (err: any) {
    console.error('Chat error:', err.message);
    res.status(500).json({error: 'Failed to get chat response'});
  }
});

// Vision: send a webcam frame to a vision-capable model and ask it to describe.
// Routed through OpenAI (gpt-4o-mini) by default since OpenClaw's chat
// gateway doesn't accept OpenAI multimodal image_url content.
const visionClient = process.env.VISION_USE_OPENCLAW === '1' ? chatClient : openai;
const VISION_MODEL = process.env.VISION_MODEL || 'gpt-4o-mini';

app.post('/api/vision', async (req, res) => {
  try {
    const {imageBase64, prompt, mode} = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({error: 'imageBase64 required'});
      return;
    }
    const dataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const systemPrompt =
      mode === 'sketch'
        ? "You are kenken64, a friendly, witty AI avatar. The user just drew a quick doodle on a small canvas and is showing it to you. Be warm, playful, and encouraging — guess what it is, react to it, and tease them gently if it's rough. Keep it to 1 to 3 sentences. Your reply will be spoken aloud, so be conversational and natural."
        : 'You are kenken64, a friendly, witty AI avatar. The user is showing you a webcam frame — describe what you see clearly and concisely in 1 to 3 sentences. Your reply will be spoken aloud, so be conversational and natural.';

    const defaultUserPrompt =
      mode === 'sketch' ? 'I drew this. What do you think it is?' : 'What do you see in this image?';

    const completion = await visionClient.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {role: 'system', content: systemPrompt},
        {
          role: 'user',
          content: [
            {type: 'text', text: prompt || defaultUserPrompt},
            {type: 'image_url', image_url: {url: dataUrl}},
          ] as any,
        },
      ],
      max_tokens: 200,
    });

    const reply =
      completion.choices[0]?.message?.content ||
      "I can't quite tell what I'm looking at.";
    res.json({reply});
  } catch (err: any) {
    console.error('Vision error:', err.message);
    res.status(500).json({error: 'Failed to analyze image'});
  }
});

// Image generation (DALL-E 3)
app.post('/api/image', async (req, res) => {
  try {
    const {prompt} = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({error: 'prompt required'});
      return;
    }
    const imageUrl = await generateImage(prompt);
    if (!imageUrl) {
      res.status(500).json({error: 'Failed to generate image'});
      return;
    }
    res.json({imageUrl});
  } catch (err: any) {
    console.error('Image error:', err.message);
    res.status(500).json({error: 'Failed to generate image'});
  }
});

// Text-to-speech
app.post('/api/tts', async (req, res) => {
  try {
    const {text, voice = 'onyx'} = req.body;

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice,
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  } catch (err: any) {
    console.error('TTS error:', err.message);
    res.status(500).json({error: 'Failed to generate speech'});
  }
});

// Speech-to-text (Whisper)
app.post('/api/transcribe', async (req, res) => {
  try {
    const {audio} = req.body; // base64-encoded webm audio
    if (!audio) {
      res.status(400).json({error: 'No audio data provided'});
      return;
    }

    const buffer = Buffer.from(audio, 'base64');

    // Run English and Chinese transcriptions in parallel; pick the one
    // Whisper is more confident in (higher avg_logprob). This avoids
    // English audio being misdetected as Chinese.
    const [en, zh] = await Promise.all([
      openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: await toFile(buffer, 'recording.webm', {type: 'audio/webm'}),
        language: 'en',
        response_format: 'verbose_json',
      }),
      openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: await toFile(buffer, 'recording.webm', {type: 'audio/webm'}),
        language: 'zh',
        response_format: 'verbose_json',
      }),
    ]);

    const avgLogprob = (t: any) => {
      const segs = t.segments || [];
      if (!segs.length) return -Infinity;
      return segs.reduce((s: number, x: any) => s + (x.avg_logprob ?? -10), 0) / segs.length;
    };

    const winner = avgLogprob(en) >= avgLogprob(zh) ? en : zh;
    res.json({text: winner.text});
  } catch (err: any) {
    console.error('Transcription error:', err.message);
    res.status(500).json({error: 'Failed to transcribe audio'});
  }
});

// Translate text — auto-detects direction (English ↔ Simplified Chinese)
// based on whether the input contains Han characters. Output is the
// translation only, no preamble.
app.post('/api/translate', async (req, res) => {
  try {
    const {text, targetLang} = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({error: 'text required'});
      return;
    }
    const isChinese = /[一-鿿]/.test(text);
    const target = targetLang === 'zh' || targetLang === 'en'
      ? targetLang
      : (isChinese ? 'en' : 'zh');
    const targetName = target === 'zh' ? 'Simplified Chinese' : 'English';

    const reply = await ollamaChat([
      {
        role: 'system',
        content:
          `You are a precise translator. Translate the user's text to ${targetName}. Output ONLY the translation — no quotes, no explanation, no preamble. Preserve tone and intent.`,
      },
      {role: 'user', content: text},
    ]);

    res.json({translation: (reply ?? '').trim(), targetLang: target});
  } catch (err: any) {
    console.error('Translate error:', err.message);
    res.status(500).json({error: 'Failed to translate'});
  }
});

// "Guess this music" — record ~10s, transcribe lyrics with Whisper, ask
// kenken64 to guess the song. Honest fail mode: instrumental tracks return no
// lyrics and kenken64 guesses the genre/mood instead.
app.post('/api/guess-music', async (req, res) => {
  try {
    const {audio} = req.body;
    if (!audio) {
      res.status(400).json({error: 'No audio data provided'});
      return;
    }
    const buffer = Buffer.from(audio, 'base64');

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: await toFile(buffer, 'music.webm', {type: 'audio/webm'}),
      response_format: 'text',
    });
    const lyrics = String(transcription ?? '').trim();

    const guessPrompt = lyrics
      ? `Someone just played me a snippet of music. The lyrics I caught were: "${lyrics}". Guess what song this is. Be playful — if you recognize it confidently, name it; if you're unsure, say "I think it might be..." and offer your best guess. Keep it to 1-3 sentences. Your reply will be spoken aloud.`
      : `Someone played me a snippet of music but I couldn't catch any lyrics — it's probably instrumental or muddy. Playfully admit you can't quite catch the song and guess the genre/mood instead. Keep it to 1-3 sentences. Your reply will be spoken aloud.`;

    const reply = await ollamaChat([
      {
        role: 'system',
        content:
          "You are kenken64, a friendly, witty AI avatar who loves music. You're playing a song-guessing game with the user.",
      },
      {role: 'user', content: guessPrompt},
    ]);

    res.json({
      reply: reply || "I'm not sure what that is, but it sounded fun!",
      lyrics,
    });
  } catch (err: any) {
    console.error('Music guess error:', err.message);
    res.status(500).json({error: 'Failed to identify music'});
  }
});

// --- Message queue for Telegram → Avatar (no WebSocket support) ---
// simple in-memory queue for polled clients
const messageQueue: string[] = [];

// OpenClaw (or any external client) POSTs here to push a message to the avatar
app.post('/api/inject', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text required' });
    return;
  }

  // push to in-memory queue so pollers can fetch
  messageQueue.push(text);

  console.log(`[inject] Queued message (queue length=${messageQueue.length}): ${text.slice(0, 80)}`);
  res.json({ ok: true, clients: 0 });
});

// Poll endpoint for browsers
app.get('/api/poll', (req, res) => {
  const copies = messageQueue.splice(0, messageQueue.length);
  res.json({ messages: copies });
});

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (no WebSocket support)`);
});
