# Technical Design — Remotion 3D AI Avatar

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Status | Draft |
| Last Updated | 2026-04-08 |
| Companion Doc | [PRD.md](./PRD.md) |

This document describes the technical architecture, stack, and implementation details for the Remotion 3D AI Avatar. For product goals, user stories, and scope, see the [PRD](./PRD.md).

---

## 1. Architecture

### 1.1 High-Level Diagram

```
┌─────────────────────┐         ┌──────────────────────┐         ┌──────────────┐
│  Browser (Vite/R3F) │  HTTP   │  Express (Node.js)   │  HTTPS  │  OpenAI API  │
│  - 3D Avatar        │ ──────► │  /api/chat           │ ──────► │  GPT-4o-mini │
│  - Chat panel       │         │  /api/tts            │         │  TTS-1       │
│  - Push-to-talk     │ ◄────── │  /api/transcribe     │ ◄────── │  Whisper-1   │
│  - Lip-sync engine  │  JSON / │                      │         │              │
└─────────────────────┘  audio  └──────────────────────┘         └──────────────┘
```

### 1.2 Runtime Topology
- **Frontend** — Vite dev server on port 3000, serving the React app and 3D scene.
- **Backend** — Express server on port 3001, exposing REST endpoints under `/api/*`.
- **Proxy** — `vite.config.ts` proxies `/api/*` from the frontend to the Express backend so the browser only talks to a single origin.
- **External** — All AI calls (chat, TTS, STT) go to OpenAI from the Express server. The browser never sees the OpenAI API key.

### 1.3 State & Persistence
- No database. No session store. No file storage.
- Conversation history is held in browser memory (React state) and re-sent on every `/api/chat` call so the model has full context.
- Audio blobs are kept only for the lifetime of the current playback (plus replay).

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend Framework | React 19, Vite 8, TypeScript | UI, dev server, build pipeline |
| 3D Rendering | Three.js, `@react-three/fiber`, `@react-three/drei` | Declarative 3D scene & helpers |
| AI / Speech | `openai` SDK v6 — GPT-4o-mini, TTS-1, Whisper-1 | Chat, speech synthesis, transcription |
| Backend | Express 5, Node.js 18+, `tsx`, `dotenv`, `cors` | API server, env config, CORS |
| Video Rendering | Remotion 4 (`@remotion/cli`, `@remotion/player`) | Offline MP4 rendering |
| Tooling | `concurrently`, TypeScript 6 | Parallel dev processes, type checking |

### 2.1 Version Pins (from `package.json`)
- `react`, `react-dom`: ^19.2.4
- `@react-three/fiber`: ^9.5.0
- `@react-three/drei`: ^10.7.7
- `three`: ^0.183.2
- `openai`: ^6.33.0
- `express`: ^5.2.1
- `remotion`, `@remotion/cli`, `@remotion/player`: ^4.0.445
- `vite`: ^8.0.3
- `typescript`: ^6.0.2

---

## 3. Module Breakdown

### 3.1 Backend (`server/index.ts`)
Single-file Express app exposing three endpoints. Loads `OPENAI_API_KEY` from `.env` via `dotenv`. Uses `cors()` and `express.json({ limit: '10mb' })` to accept base64-encoded audio uploads.

| Endpoint | Method | Behavior |
|----------|--------|----------|
| `/api/chat` | POST | Accepts `{ messages }`. Detects Chinese vs English from the latest user message via a `[\u4e00-\u9fff]` regex (`hasChinese`). Injects a language-locked system prompt and calls `openai.chat.completions.create({ model: 'gpt-4o-mini', max_tokens: 150 })`. Returns `{ reply }`. |
| `/api/tts` | POST | Accepts `{ text, voice = 'onyx' }`. Calls `openai.audio.speech.create({ model: 'tts-1', voice, input: text })`. Returns the MP3 buffer with `Content-Type: audio/mpeg`. |
| `/api/transcribe` | POST | Accepts `{ audio }` (base64 webm). Wraps the buffer with `toFile(...)` and calls `openai.audio.transcriptions.create({ model: 'whisper-1', ... })` with a bilingual prompt hint. Returns `{ text }`. |

System prompt (chat):
> "You are a friendly, witty AI avatar assistant. Keep your responses concise — 1 to 3 sentences maximum, since your words will be spoken aloud. Be conversational and natural. {languageInstruction}"

### 3.2 Frontend App (`src/app/`)
| File | Responsibility |
|------|----------------|
| `main.tsx` | Vite entry point; mounts `<App />`. |
| `App.tsx` | Top-level layout: 3D avatar canvas + chat panel + push-to-talk + replay. Manages chat state and current speaking state. |
| `api.ts` | Thin client wrappers around `/api/chat`, `/api/tts`, `/api/transcribe`. |
| `useAudioLipSync.ts` | Hook that loads the TTS audio, starts playback, and drives the active viseme + subtitle index from `audio.currentTime` via `requestAnimationFrame`. |
| `AvatarIcon.tsx` | UI thumbnail icon. |

### 3.3 3D Avatar (`src/Avatar3D.tsx`)
- React Three Fiber scene: head, eyes, glasses, swept hair, suit + tie, crossed arms.
- Idle animation: subtle breathing + head sway when not speaking.
- Mouth supports 9 visemes — `A`, `E`, `I`, `O`, `U`, `F`, `L`, `M`, and `closed` — selected by the lip-sync hook each frame.
- Background: space-themed scene composed in the same canvas.

### 3.4 Lip-Sync Engine (`src/lipSync.ts`)
- Pure function module: maps a response string to a sequence of visemes by character-class lookup.
- Output is consumed by `useAudioLipSync.ts`, which interpolates the active viseme based on `audio.currentTime / audio.duration` against the viseme timeline.
- Subtitles are typewritten in step with the same time cursor.

### 3.5 Remotion (`src/index.ts`, `src/Root.tsx`, `src/AvatarComposition.tsx`, `src/CartoonAvatar.tsx`)
- Separate offline render path. Uses a 2D SVG character (`CartoonAvatar.tsx`) instead of the live 3D avatar so renders are deterministic and fast.
- `npm run studio` opens Remotion Studio against `src/index.ts`.
- `npm run build` runs `remotion render src/index.ts Avatar out/avatar.mp4`.

---

## 4. Data Flow

### 4.1 Text Chat → Spoken Reply
1. User types a message; `App.tsx` appends it to `messages` and calls `POST /api/chat`.
2. Server runs language detection, calls GPT-4o-mini, returns `{ reply }`.
3. Client calls `POST /api/tts` with the reply text; server returns an MP3.
4. `useAudioLipSync` loads the MP3 into an `<audio>` element, starts playback, and on every animation frame:
   - Reads `audio.currentTime`.
   - Selects the active viseme from the precomputed timeline.
   - Updates the visible subtitle prefix.
5. On `ended`, the reply settles into the chat history as a normal message.

### 4.2 Voice Loop (Push-to-Talk)
1. User holds the PTT button; the browser starts `MediaRecorder` on the mic stream (webm/opus).
2. On release, the recording is base64-encoded and sent to `POST /api/transcribe`.
3. Server returns `{ text }` from Whisper; the frontend submits it through the same path as 4.1.

---

## 5. Configuration

| Variable | Where | Purpose |
|----------|-------|---------|
| `OPENAI_API_KEY` | `.env` (server-only) | OpenAI auth — never exposed to the browser |
| `PORT` | `.env` (optional) | Express port; defaults to `3001` |

Vite proxy: `/api/*` → `http://localhost:3001` (configured in `vite.config.ts`).

---

## 6. Build & Run

| Command | Description |
|---------|-------------|
| `npm run dev` | Runs Express + Vite in parallel via `concurrently` |
| `npm run dev:client` | Vite frontend only |
| `npm run dev:server` | Express backend only |
| `npm run studio` | Open Remotion Studio |
| `npm run build` | Render avatar to `out/avatar.mp4` |
| `npm run upgrade` | `remotion upgrade` |

---

## 7. Non-Functional Targets

| Category | Requirement |
|----------|-------------|
| Performance | ≥30 FPS in modern browsers; <3 s from "send" to first audio sample for short replies |
| Browser Support | Latest Chrome, Edge, Safari, Firefox on desktop. WebAudio + `getUserMedia` required for voice input |
| Accessibility | Subtitles always available; keyboard usable for text input |
| Security | API key stays server-side; CORS enabled for the local dev origin |
| Portability | Pure Node.js + Vite — no native deps, no GPU on the server |

---

## 8. Known Constraints & Trade-offs

- **Non-streaming TTS** — `/api/tts` waits for the full MP3 before returning. Adds latency vs streaming, but keeps the lip-sync engine simple (it needs a known total duration).
- **Character-based visemes** — `lipSync.ts` uses orthographic mapping rather than phoneme analysis. Cheap and language-agnostic, but less accurate than a phoneme-based approach.
- **In-memory history** — Refreshing the page loses the conversation. Acceptable for a reference implementation; would need `localStorage`/DB for production.
- **Two avatar pipelines** — The interactive app uses 3D (R3F); Remotion renders use a 2D SVG. Means the offline video does not match the live avatar 1:1.
- **Single provider** — All AI calls hit OpenAI. No abstraction layer for swapping in Anthropic, ElevenLabs, or local models.

---

## 9. References

- Repository: `kenken64/remotion-3d-AI-avatar`
- Key source files:
  - `server/index.ts` — backend & OpenAI calls
  - `src/Avatar3D.tsx` — 3D character
  - `src/lipSync.ts` — viseme mapping
  - `src/app/App.tsx` — top-level UI
  - `src/app/useAudioLipSync.ts` — playback + sync hook
  - `src/AvatarComposition.tsx`, `src/CartoonAvatar.tsx` — Remotion render path
- External APIs: OpenAI Chat Completions, OpenAI Audio (TTS + Whisper)
- Frameworks: React Three Fiber, Remotion 4
