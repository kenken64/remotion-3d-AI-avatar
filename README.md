# Remotion 3D AI Avatar

A 3D AI-powered talking avatar with real-time lip-sync. Chat with the avatar through a web interface — it responds using OpenAI GPT and speaks with synchronized mouth animation driven by OpenAI TTS audio.

![3D Avatar](https://img.shields.io/badge/3D-React%20Three%20Fiber-blue)
![AI](https://img.shields.io/badge/AI-OpenAI%20GPT--4o--mini-green)
![TTS](https://img.shields.io/badge/TTS-OpenAI%20Speech-orange)

## Features

- **3D Avatar** — Built with React Three Fiber: head, eyes, glasses, swept hair, black suit with tie, crossed arms. Includes idle breathing animation and subtle head movement.
- **AI Chat** — Powered by OpenAI GPT-4o-mini with full conversation history. Responses are concise and natural for spoken delivery.
- **Text-to-Speech** — OpenAI TTS generates audio for each response (voice: "onyx").
- **Lip-Sync** — Mouth shapes (visemes) are synced to actual audio playback using `requestAnimationFrame` polling `audio.currentTime`. Characters map to 9 distinct mouth shapes: A, E, I, O, U, F, L, M, and closed.
- **Subtitle Text** — Real-time typewriter-style subtitles displayed over the avatar while speaking.
- **Chat Panel** — Clean chat UI with message history, typing indicators, and thinking state.
- **Remotion Studio** — Separate Remotion composition for offline video rendering with the 2D SVG avatar.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React, Vite, TypeScript |
| 3D Rendering | Three.js, React Three Fiber, Drei |
| AI | OpenAI GPT-4o-mini (chat), OpenAI TTS (speech) |
| Backend | Express, Node.js |
| Video Rendering | Remotion |

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key

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
```

### Run the App

```bash
npm run dev
```

This starts both the Express backend (port 3001) and Vite frontend (port 3000). Open **http://localhost:3000** in your browser.

### Other Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start full app (backend + frontend) |
| `npm run dev:client` | Start Vite frontend only |
| `npm run dev:server` | Start Express backend only |
| `npm run studio` | Open Remotion Studio |
| `npm run build` | Render avatar video to `out/avatar.mp4` |

## Project Structure

```
├── server/
│   └── index.ts              # Express API server (chat + TTS endpoints)
├── src/
│   ├── app/
│   │   ├── main.tsx           # Vite app entry point
│   │   ├── App.tsx            # Main app: 3D avatar + chat panel
│   │   ├── api.ts             # Client API service (chat, TTS)
│   │   └── useAudioLipSync.ts # Audio playback + lip-sync hook
│   ├── Avatar3D.tsx           # 3D avatar (React Three Fiber)
│   ├── CartoonAvatar.tsx      # 2D SVG avatar (for Remotion)
│   ├── AvatarComposition.tsx  # Remotion composition
│   ├── lipSync.ts             # Text-to-viseme engine
│   ├── Root.tsx               # Remotion root
│   └── index.ts               # Remotion entry point
├── .env.example               # Environment variable template
├── vite.config.ts             # Vite config with API proxy
├── remotion.config.ts         # Remotion config
└── package.json
```

## How It Works

1. User types a message in the chat panel
2. Message is sent to the Express backend → OpenAI Chat Completions API
3. AI response text is sent to OpenAI TTS API → returns MP3 audio
4. Frontend plays the audio and syncs lip animation:
   - Audio duration determines total animation frames
   - Each character maps to a viseme (mouth shape)
   - `requestAnimationFrame` polls `audio.currentTime` to drive mouth shape changes
   - Subtitle text types out in sync with the audio
5. When audio ends, the response appears as a chat bubble

## License

ISC
