# Remotion 3D AI Avatar

A browser-based AI avatar built with React, Vite, React Three Fiber, and Remotion. Users can chat with Mona Lau by text or voice, hear spoken responses with live lip-sync, trigger webcam-based vision prompts, and render offline avatar videos.

![3D Avatar](https://img.shields.io/badge/3D-React%20Three%20Fiber-blue)
![AI](https://img.shields.io/badge/AI-OpenAI%20GPT--4o--mini-green)
![TTS](https://img.shields.io/badge/TTS-OpenAI%20Speech-orange)

## Features

- **Framed 3D Avatar** — A GLB-based head-and-shoulders avatar rendered with React Three Fiber, with idle motion, blinking, and viseme-driven mouth animation.
- **Text + Voice Chat** — Users can type, click-to-record, or use a push-to-talk mode to interact with the avatar.
- **Wake Word** — Optional browser speech-recognition support for phrases like `hey mona`.
- **Webcam Vision** — Optional webcam preview and voice-triggered scene description using a vision-capable model.
- **Image Generation** — Image-like requests can return a generated image inline in the chat thread.
- **Spoken Replies** — OpenAI TTS generates reply audio and the UI supports replay and mute.
- **Lip-Sync + Subtitles** — Mouth shapes and subtitle reveal are driven from actual audio playback time.
- **Conversation History** — Chat history is persisted in `localStorage` and restored on reload.
- **Responsive UI** — Desktop split layout, mobile bottom-sheet chat, full-screen support, status overlays, and webcam inset preview.
- **Remotion Render Path** — Separate offline composition for exporting avatar videos to MP4.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React, Vite, TypeScript |
| 3D Rendering | Three.js, React Three Fiber, Drei |
| AI | OpenAI-compatible chat endpoint, OpenAI TTS, OpenAI Whisper, OpenAI vision/image APIs |
| Backend | Express, Node.js |
| Video Rendering | Remotion |

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key
- Optional OpenAI-compatible chat endpoint if you do not want chat completions to use the default local OpenClaw-compatible URL

### Installation

```bash
git clone https://github.com/kenken64/remotion-3d-AI-avatar.git
cd remotion-3d-AI-avatar
npm install
```

### Configuration

Create a `.env` file in the project root:

```
OPENAI_API_KEY=sk-your-openai-api-key
PORT=3001

# Optional chat endpoint override
CHAT_BASE_URL=http://127.0.0.1:18789/v1
CHAT_API_KEY=your-chat-api-key
CHAT_MODEL=gpt-4o-mini

# Optional vision routing override
VISION_USE_OPENCLAW=0
VISION_MODEL=gpt-4o-mini
```

### Environment Variables

| Variable | Required | Purpose |
|---------|----------|---------|
| `OPENAI_API_KEY` | Yes | Used for TTS, transcription, image generation, and vision by default |
| `PORT` | No | Express server port, defaults to `3001` |
| `CHAT_BASE_URL` | No | OpenAI-compatible chat base URL, defaults to `http://127.0.0.1:18789/v1` |
| `CHAT_API_KEY` | No | API key for the chat endpoint; falls back to `OPENAI_API_KEY` |
| `CHAT_MODEL` | No | Chat model name, defaults to `gpt-4o-mini` |
| `VISION_USE_OPENCLAW` | No | When set to `1`, routes vision through the chat client instead of OpenAI |
| `VISION_MODEL` | No | Vision model name, defaults to `gpt-4o-mini` |

### Run the App

```bash
npm run dev
```

This starts both the Express backend and the Vite frontend.

- Backend: `http://localhost:3001`
- Frontend dev server: `http://localhost:3002`
- App base path: `http://localhost:3002/remotion`

Open `http://localhost:3002/remotion` in your browser.

### Other Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start full app (backend + frontend) |
| `npm run dev:client` | Start Vite frontend only |
| `npm run dev:server` | Start Express backend only |
| `npm run studio` | Open Remotion Studio |
| `npm run build` | Render avatar video to `out/avatar.mp4` |

## Runtime Capabilities

### Interactive App

- Text chat with a spoken avatar reply
- Mic recording with automatic silence stop
- Push-to-talk mode
- Wake-word mode when browser speech recognition is available
- Webcam preview and webcam-to-vision prompt flow
- Inline generated-image responses
- Replayable and mutable avatar audio
- Full-screen avatar scene and mobile-first chat sheet behavior

### Backend API

| Endpoint | Method | Purpose |
|---------|--------|---------|
| `/api/chat` | `POST` | Chat completion with language routing and optional image generation |
| `/api/tts` | `POST` | Convert reply text to MP3 |
| `/api/transcribe` | `POST` | Transcribe recorded speech, comparing English and Chinese results |
| `/api/vision` | `POST` | Describe a webcam frame |
| `/api/image` | `POST` | Generate an image from a prompt |
| `/api/inject` | `POST` | Queue an external message for the app |
| `/api/poll` | `GET` | Deliver queued external messages to the browser |

## Project Structure

```
├── server/
│   └── index.ts               # Express API server and AI integration layer
├── src/
│   ├── app/
│   │   ├── main.tsx           # Vite app entry point
│   │   ├── App.tsx            # Main app: avatar scene, chat, voice, webcam
│   │   ├── api.ts             # Client API service
│   │   └── useAudioLipSync.ts # Audio playback + lip-sync hook
│   ├── Avatar3D.tsx           # Live 3D avatar scene
│   ├── CartoonAvatar.tsx      # 2D avatar for Remotion renders
│   ├── AvatarComposition.tsx  # Remotion composition
│   ├── lipSync.ts             # Text-to-viseme engine
│   ├── Root.tsx               # Remotion root
│   └── index.ts               # Remotion entry point
├── docs/
│   ├── PRD.md                 # Product requirements draft
│   ├── TECHNICAL.md           # Technical design draft
│   └── PRDs/                  # Reverse-engineered PRD variants
├── vite.config.ts             # Vite config with API proxy
├── remotion.config.ts         # Remotion config
└── package.json
```

## How It Works

1. The user sends text, records speech, or triggers a wake-word/webcam flow.
2. The frontend sends conversation history or media payloads to the Express backend.
3. The backend routes chat to an OpenAI-compatible chat endpoint, while transcription, TTS, image generation, and vision use OpenAI by default.
4. The frontend receives reply text and optional image data, requests speech audio, and starts playback.
5. Lip-sync and subtitle reveal are driven from `audio.currentTime` so the avatar mouth stays aligned with the spoken reply.
6. The UI stores the conversation in local storage and exposes replay, mute, full-screen, and responsive chat controls.

## Notes

- Vite is served with `base: '/remotion'`, so local and deployed URLs use the `/remotion` path prefix.
- The live interactive app uses the 3D avatar in `src/Avatar3D.tsx`, while the Remotion export path uses the 2D composition in `src/AvatarComposition.tsx`.
- Browser-dependent features such as speech recognition, webcam, vibration, and device motion may vary by browser and device.

## License

ISC
