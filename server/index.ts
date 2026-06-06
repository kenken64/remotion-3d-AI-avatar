import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import OpenAI, {toFile} from 'openai';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';

dotenv.config();

const app = express();
app.use(cors());
// Raised from 10mb to fit base64-encoded file attachments (an image/document
// can be up to ~4.5MB raw, ~6MB base64, plus conversation history).
app.use(express.json({limit: '25mb'}));

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

// Chat (the avatar's "brain") runs on Amazon Bedrock via the native Converse
// API. We authenticate with a Bedrock API key (CHAT_API_KEY) passed as a Bearer
// token — no AWS credentials or SigV4 signing required. BEDROCK_REGION selects
// the runtime region and CHAT_MODEL selects the model/inference-profile id, e.g.
// global.anthropic.claude-opus-4-5-20251101-v1:0 (a "global." profile routes
// across regions, so it is reachable from ap-southeast-1).
const BEDROCK_REGION = process.env.BEDROCK_REGION || 'ap-southeast-1';
const CHAT_MODEL =
  process.env.CHAT_MODEL || 'global.anthropic.claude-opus-4-5-20251101-v1:0';
const AVATAR_NAME = process.env.VITE_AVATAR_NAME || 'kenken64';

const bedrock = new BedrockRuntimeClient({
  region: BEDROCK_REGION,
  token: {token: process.env.CHAT_API_KEY || ''},
  authSchemePreference: ['httpBearerAuth'],
});

type ChatMsg = {role: string; content: string};

// A file attachment sent alongside a chat turn. `data` is base64-encoded bytes.
type ChatAttachment = {
  kind: 'image' | 'document';
  name: string;
  mediaType: string;
  data: string;
};

// Bedrock Converse content-block constraints (see AWS Converse API reference).
const IMAGE_FORMATS = new Set(['png', 'jpeg', 'gif', 'webp']);
const DOC_FORMATS = new Set([
  'pdf', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'html', 'txt', 'md',
]);
// Filename-extension aliases → canonical Bedrock document format.
const DOC_EXT_ALIASES: Record<string, string> = {markdown: 'md', htm: 'html'};
const DOC_MIME_TO_FORMAT: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/html': 'html',
  'text/plain': 'txt',
  'text/markdown': 'md',
};
const MAX_IMAGE_BYTES = 3.75 * 1024 * 1024;
const MAX_DOC_BYTES = 4.5 * 1024 * 1024;

// Bedrock document names allow only alphanumerics, single spaces, hyphens,
// parentheses and square brackets (1–200 chars, no extension/dots).
function safeDocName(raw: string): string {
  const cleaned = (raw || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9\-()[\] ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  return cleaned.length ? cleaned : 'document';
}

// Convert an incoming attachment into a Bedrock Converse content block. Returns
// null (and logs) for missing / oversized / unsupported attachments, so a bad
// attachment degrades to a text-only turn instead of failing the whole reply.
function attachmentToBlock(att: ChatAttachment): any | null {
  if (!att || typeof att.data !== 'string' || !att.data) return null;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(att.data, 'base64');
  } catch {
    return null;
  }
  if (!bytes.length) return null;

  if (att.kind === 'image') {
    if (bytes.length > MAX_IMAGE_BYTES) {
      console.warn(`[attach] image too large (${bytes.length}B), skipping`);
      return null;
    }
    const format = (att.mediaType || '')
      .toLowerCase()
      .replace(/^image\//, '')
      .replace('jpg', 'jpeg');
    if (!IMAGE_FORMATS.has(format)) {
      console.warn(`[attach] unsupported image type "${att.mediaType}", skipping`);
      return null;
    }
    return {image: {format, source: {bytes}}};
  }

  if (bytes.length > MAX_DOC_BYTES) {
    console.warn(`[attach] document too large (${bytes.length}B), skipping`);
    return null;
  }
  // Resolve the document format. Prefer the filename extension — it is the most
  // reliable signal (these enum values ARE the extensions, and browsers report
  // inconsistent MIME types, e.g. .csv as application/vnd.ms-excel) — then fall
  // back to the declared MIME type. att.name is guarded in case it is absent.
  const ext = (typeof att.name === 'string' ? att.name.split('.').pop() || '' : '').toLowerCase();
  const normExt = DOC_EXT_ALIASES[ext] || ext;
  let format = DOC_FORMATS.has(normExt) ? normExt : '';
  if (!format) format = DOC_MIME_TO_FORMAT[(att.mediaType || '').toLowerCase()] || '';
  if (!format || !DOC_FORMATS.has(format)) {
    console.warn(`[attach] unsupported document "${att.mediaType}"/"${att.name}", skipping`);
    return null;
  }
  return {document: {name: safeDocName(att.name), format, source: {bytes}}};
}

// Append an attachment's content block to the most recent user turn so the
// model sees the file alongside the current prompt.
function appendAttachment(turns: {role: string; content: any[]}[], attachment?: ChatAttachment): void {
  if (!attachment) return;
  let block: any | null = null;
  try {
    block = attachmentToBlock(attachment);
  } catch (err: any) {
    console.warn('[attach] could not build content block, skipping:', err?.message);
    return;
  }
  if (!block) return;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === 'user') {
      turns[i].content.push(block);
      return;
    }
  }
}

// Convert our flat {role, content} list (which may start with a `system`
// message) into the shape the Converse API expects: a separate `system` block
// plus user/assistant turns whose content is an array of content blocks.
function toConverse(messages: ChatMsg[]) {
  const system: {text: string}[] = [];
  const turns: {role: 'user' | 'assistant'; content: any[]}[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      system.push({text: m.content});
    } else {
      turns.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: [{text: m.content}],
      });
    }
  }
  return {system, turns};
}

// Non-streaming chat completion via the Bedrock Converse API.
async function chatComplete(messages: ChatMsg[], attachment?: ChatAttachment): Promise<string> {
  const {system, turns} = toConverse(messages);
  appendAttachment(turns, attachment);
  const out = await bedrock.send(
    new ConverseCommand({
      modelId: CHAT_MODEL,
      system: system.length ? system : undefined,
      messages: turns as any,
      inferenceConfig: {maxTokens: 512},
    }),
  );
  return (out.output?.message?.content ?? [])
    .map((b: any) => b.text ?? '')
    .join('');
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
    const {messages, attachment} = req.body;

    // Detect language from the latest user message
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const userText = lastUserMsg?.content || '';
    const isChinese = hasChinese(userText);

    const languageInstruction = isChinese
      ? 'The user is speaking Chinese. You MUST reply in Chinese (Simplified Mandarin). Do not reply in English.'
      : 'The user is speaking English. You MUST reply in English. Do not reply in Chinese.';

    const wantsImage = isImageRequest(userText);

    const [replyText, imageUrl] = await Promise.all([
      chatComplete(
        [
          {
            role: 'system',
            content:
              `You are ${AVATAR_NAME}, a friendly, witty AI avatar assistant. Keep your responses concise — 1 to 3 sentences maximum, since your words will be spoken aloud. Be conversational and natural.${wantsImage ? ' The user is asking for an image; one is being generated for them, so briefly acknowledge it (e.g. "Here you go!") in your reply.' : ''} ${languageInstruction}`,
          },
          ...messages,
        ],
        attachment,
      ),
      wantsImage ? generateImage(userText) : Promise.resolve(null),
    ]);

    const reply = replyText || (isChinese ? '我不确定该说什么。' : "I'm not sure what to say.");
    res.json({reply, imageUrl: imageUrl || undefined});
  } catch (err: any) {
    console.error('Chat error:', err.message);
    res.status(500).json({error: 'Failed to get chat response'});
  }
});

// Streaming chat — same prompt shape as /api/chat, but proxies ttyproxy's
// streaming Ollama response as Server-Sent Events. Clients receive incremental
// `delta` events with token text, then a final `done` event carrying any
// generated image URL. This lets the client begin per-sentence TTS the moment
// the first sentence boundary arrives instead of waiting for the full reply.
app.post('/api/chat-stream', async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Abort upstream only if the *response* socket closes before we've sent
  // res.end(). We can't use req.on('close') here: under Express 5 / Node 24
  // it fires as soon as the request body is parsed, which would kill every
  // stream before the first token.
  const upstream = new AbortController();
  let responseEnded = false;
  res.on('close', () => {
    if (!responseEnded) upstream.abort();
  });

  try {
    const {messages, attachment} = req.body;
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const userText = lastUserMsg?.content || '';
    const isChinese = hasChinese(userText);
    const wantsImage = isImageRequest(userText);
    const languageInstruction = isChinese
      ? 'The user is speaking Chinese. You MUST reply in Chinese (Simplified Mandarin). Do not reply in English.'
      : 'The user is speaking English. You MUST reply in English. Do not reply in Chinese.';

    const imagePromise: Promise<string | null> = wantsImage
      ? generateImage(userText)
      : Promise.resolve(null);

    const {system, turns} = toConverse([
      {
        role: 'system',
        content: `You are ${AVATAR_NAME}, a friendly, witty AI avatar assistant. Keep your responses concise — 1 to 3 sentences maximum, since your words will be spoken aloud. Be conversational and natural.${
          wantsImage
            ? ' The user is asking for an image; one is being generated for them, so briefly acknowledge it (e.g. "Here you go!") in your reply.'
            : ''
        } ${languageInstruction}`,
      },
      ...messages,
    ]);
    appendAttachment(turns, attachment);

    const upstreamRes = await bedrock.send(
      new ConverseStreamCommand({
        modelId: CHAT_MODEL,
        system: system.length ? system : undefined,
        messages: turns as any,
        inferenceConfig: {maxTokens: 512},
      }),
      {abortSignal: upstream.signal},
    );

    let full = '';
    for await (const event of upstreamRes.stream ?? []) {
      const delta = event.contentBlockDelta?.delta?.text || '';
      if (delta) {
        full += delta;
        send('delta', {text: delta});
      }
    }

    const fallback = isChinese ? '我不确定该说什么。' : "I'm not sure what to say.";
    if (!full.trim()) {
      full = fallback;
      send('delta', {text: full});
    }

    const imageUrl = await imagePromise;
    send('done', {full, imageUrl: imageUrl || undefined});
    responseEnded = true;
    res.end();
  } catch (err: any) {
    console.error('Chat stream error:', err.message);
    try {
      send('error', {error: err.message || 'stream failed'});
    } catch {
      /* socket already closed */
    }
    responseEnded = true;
    res.end();
  }
});

// Vision: send a webcam frame to a vision-capable model and ask it to describe.
// Routed through OpenAI (gpt-4o-mini) — the chat brain runs on Bedrock's Converse
// API, which uses a different multimodal content shape than OpenAI image_url.
const visionClient = openai;
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
        ? `You are ${AVATAR_NAME}, a friendly, witty AI avatar. The user just drew a quick doodle on a small canvas and is showing it to you. Be warm, playful, and encouraging — guess what it is, react to it, and tease them gently if it's rough. Keep it to 1 to 3 sentences. Your reply will be spoken aloud, so be conversational and natural.`
        : `You are ${AVATAR_NAME}, a friendly, witty AI avatar. The user is showing you a webcam frame — describe what you see clearly and concisely in 1 to 3 sentences. Your reply will be spoken aloud, so be conversational and natural.`;

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
// Voice can be overridden per-request; falls back to TTS_VOICE env var,
// then 'onyx' (male). Set TTS_VOICE=nova (or shimmer/alloy) for female.
const DEFAULT_TTS_VOICE = process.env.TTS_VOICE ?? 'onyx';

app.post('/api/tts', async (req, res) => {
  try {
    const {text, voice = DEFAULT_TTS_VOICE} = req.body;

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

    const reply = await chatComplete([
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

    const reply = await chatComplete([
      {
        role: 'system',
        content:
          `You are ${AVATAR_NAME}, a friendly, witty AI avatar who loves music. You're playing a song-guessing game with the user.`,
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
