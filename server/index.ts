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

// Detect if text contains Chinese characters
function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            `You are a friendly, witty AI avatar assistant. Keep your responses concise — 1 to 3 sentences maximum, since your words will be spoken aloud. Be conversational and natural. ${languageInstruction}`,
        },
        ...messages,
      ],
      max_tokens: 150,
    });

    const reply = completion.choices[0]?.message?.content || (isChinese ? '我不确定该说什么。' : "I'm not sure what to say.");
    res.json({reply});
  } catch (err: any) {
    console.error('Chat error:', err.message);
    res.status(500).json({error: 'Failed to get chat response'});
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
    const file = await toFile(buffer, 'recording.webm', {type: 'audio/webm'});

    // Try English first, then Chinese if result is low confidence
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      prompt: 'This audio is in English or Chinese (Mandarin).',
    });

    res.json({text: transcription.text});
  } catch (err: any) {
    console.error('Transcription error:', err.message);
    res.status(500).json({error: 'Failed to transcribe audio'});
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
