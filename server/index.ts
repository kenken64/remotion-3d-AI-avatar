import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chat completions
app.post('/api/chat', async (req, res) => {
  try {
    const {messages} = req.body;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a friendly, witty AI avatar assistant. Keep your responses concise — 1 to 3 sentences maximum, since your words will be spoken aloud. Be conversational and natural.',
        },
        ...messages,
      ],
      max_tokens: 150,
    });

    const reply = completion.choices[0]?.message?.content || "I'm not sure what to say.";
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
