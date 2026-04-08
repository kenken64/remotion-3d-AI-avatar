# Product Requirements Document — Remotion 3D AI Avatar

| Field | Value |
|-------|-------|
| Product Name | Remotion 3D AI Avatar |
| Document Version | 1.0 |
| Status | Draft |
| Last Updated | 2026-04-08 |
| Owner | kenken64 |

---

## 1. Overview

### 1.1 Summary
Remotion 3D AI Avatar is a web-based, interactive talking avatar that combines a real-time 3D character (React Three Fiber) with conversational AI (OpenAI GPT-4o-mini), text-to-speech (OpenAI TTS), and speech-to-text (OpenAI Whisper). Users chat with the avatar via text or voice (push-to-talk); the avatar responds with synchronized lip movement, subtitles, and natural spoken audio. A separate Remotion composition allows offline rendering of avatar videos for non-interactive use cases.

### 1.2 Problem Statement
Most AI chatbots are text-only and feel impersonal. Existing talking-avatar products are either expensive SaaS offerings, locked into proprietary platforms, or require complex pipelines to set up. There is no lightweight, open, developer-friendly reference implementation that combines a 3D avatar, LLM chat, and synchronized speech in a single runnable repo.

### 1.3 Vision
Provide a self-hostable, hackable starting point for developers who want to embed a believable, multilingual, voice-driven AI avatar into their own products — whether a customer-support widget, learning assistant, kiosk character, or pre-rendered explainer video.

---

## 2. Goals & Non-Goals

### 2.1 Goals
- Deliver a real-time conversational experience with a 3D avatar that talks back with audio + lip-sync.
- Support both text input and push-to-talk voice input.
- Support at least English and Chinese (Simplified Mandarin), with the avatar replying in the user's input language.
- Provide a Remotion composition for rendering avatar videos offline.
- Keep the stack minimal and easy to run locally with a single OpenAI API key.

### 2.2 Non-Goals
- Photoreal facial capture or rigged FBX/GLTF character pipelines.
- Multi-user / multi-tenant hosting, accounts, or persistence beyond an in-memory chat session.
- Real-time streaming TTS (current implementation generates the full audio response first).
- Mobile-native applications (browser-only at this time).
- Voice cloning or custom-trained voices.

---

## 3. Target Users & Personas

| Persona | Description | Primary Need |
|---------|-------------|--------------|
| Indie Developer | Building a side project that needs a friendly AI persona | Drop-in chatbot with personality |
| Educator / Trainer | Producing instructional videos or interactive demos | Pre-rendered avatar videos via Remotion |
| Hackathon Builder | Wants to demo a voice AI quickly | Push-to-talk voice loop that "just works" |
| Frontend Engineer | Learning React Three Fiber and Remotion | Reference implementation to study and fork |

---

## 4. User Stories

1. **Text chat** — As a user, I can type a message in the chat panel and see/hear the avatar respond with synced mouth animation.
2. **Voice chat** — As a user, I can hold a push-to-talk button, speak, release, and have my speech transcribed and answered by the avatar.
3. **Bilingual** — As a Chinese-speaking user, I can ask a question in Mandarin and receive a spoken Mandarin reply.
4. **Subtitles** — As a user, I can read along with subtitles as the avatar speaks, in case audio is muted or unclear.
5. **Replay audio** — As a user, I can replay the avatar's last spoken response.
6. **Conversation history** — As a user, I can see my message history in the chat panel during a session.
7. **Offline render** — As a content creator, I can use Remotion Studio to render the avatar to MP4 for use in videos.

---

## 5. Functional Requirements

### 5.1 3D Avatar (`src/Avatar3D.tsx`)
- Built with React Three Fiber + Drei.
- Includes head, eyes, glasses, swept hair, suit with tie, crossed arms.
- Idle breathing animation and subtle head movement when not speaking.
- Mouth supports 9 visemes: A, E, I, O, U, F, L, M, and closed.
- Renders inside a space-themed background scene.

### 5.2 Lip-Sync Engine (`src/lipSync.ts`, `src/app/useAudioLipSync.ts`)
- Maps response text to a viseme sequence.
- Uses `requestAnimationFrame` to poll `audio.currentTime` and select the active viseme.
- Synchronizes typewriter-style subtitle reveal with audio playback.

### 5.3 Chat Backend (`server/index.ts`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | Send conversation history; receive a 1–3 sentence GPT-4o-mini reply. Detects Chinese vs English from latest user message and instructs the model to respond in the matching language. |
| `/api/tts` | POST | Convert reply text to MP3 audio via OpenAI TTS (default voice: `onyx`). |
| `/api/transcribe` | POST | Accept base64 webm audio, return transcribed text via Whisper (`whisper-1`). |

- System prompt enforces concise, conversational responses suitable for spoken delivery.
- `max_tokens` capped at 150 to keep responses short.
- CORS enabled; JSON body limit 10 MB to accommodate base64 audio uploads.

### 5.4 Frontend App (`src/app/App.tsx`)
- Chat panel with message bubbles, typing indicator, and "thinking" state.
- Push-to-talk button that records mic audio and posts to `/api/transcribe`.
- Audio replay control for the avatar's last response.
- Avatar thumbnail icon in the UI chrome.
- Real-time subtitle overlay rendered above the 3D scene.

### 5.5 Remotion Composition (`src/AvatarComposition.tsx`, `src/Root.tsx`)
- Separate offline-render path using a 2D SVG avatar (`src/CartoonAvatar.tsx`).
- `npm run studio` opens Remotion Studio for preview.
- `npm run build` renders to `out/avatar.mp4`.

---

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Avatar must maintain ≥30 FPS on a modern laptop browser. End-to-end latency from "send" to "first audio sample" should target <3 s for short replies. |
| Browser Support | Latest Chrome, Edge, Safari, Firefox on desktop. WebAudio + getUserMedia required for voice input. |
| Accessibility | Subtitles always available; chat history readable; keyboard usable for text input. |
| Security | OpenAI API key kept server-side only, loaded from `.env`. Never shipped to the browser. |
| Configurability | Single `.env` (`OPENAI_API_KEY`) is sufficient to run the app locally. |
| Portability | Pure Node.js + Vite — no native dependencies, no GPU requirement on the server. |

---

## 7. Architecture & Tech Stack

For the architecture diagram, runtime topology, tech stack, module breakdown, data flows, configuration, and build commands, see [TECHNICAL.md](./TECHNICAL.md).

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Time to first audio after send | < 3 s for short replies |
| Lip-sync alignment drift | < 80 ms perceived offset |
| End-to-end voice loop (talk → reply audio) | < 6 s for short utterances |
| Local setup time from clone to running | < 5 minutes for a developer with Node + an OpenAI key |
| Supported languages | English + Simplified Mandarin at v1 |

---

## 9. Out-of-Scope / Future Enhancements

- Streaming TTS for sub-second first-syllable latency.
- Additional languages (Japanese, Spanish, French).
- Customizable avatar appearance (clothing, hair, gender) via UI.
- GLTF/VRM character import for higher-fidelity rigs.
- Persistent chat history and user accounts.
- WebRTC-based always-on listening mode (vs push-to-talk).
- Emotion/sentiment-driven facial expressions beyond lip-sync.
- Server-side rate limiting, auth, and usage metering for hosted deployments.
- Integration with alternative LLM/TTS providers (Anthropic, ElevenLabs, local models).

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenAI API outage or rate limits | App becomes unresponsive | Surface clear error states; document retry behavior; allow provider abstraction in future |
| Lip-sync drift on slow devices | Perceived quality drop | Drive sync from `audio.currentTime` (already implemented) instead of wall-clock |
| Mic permission denied | Voice loop unusable | Fall back gracefully to text-only mode |
| Cost growth from heavy TTS use | Unexpected bills for self-hosters | Document expected per-request costs; cap response length via `max_tokens` |
| Browser autoplay policy blocks audio | First response silent | Require a user gesture (send/PTT) before audio playback — already aligned with current UX |

---

## 11. Open Questions

1. Should conversation history persist across page reloads (e.g., `localStorage`)?
2. Is there demand for an embeddable widget build (`<script>` tag) vs the current full-page app?
3. Should the Remotion render path consume the same 3D avatar, or is the 2D SVG version sufficient for offline videos?
4. Do we want a configurable system prompt / persona via UI, or keep it baked into the server?

---

## 12. References

- Companion doc: [TECHNICAL.md](./TECHNICAL.md) — architecture, stack, modules, data flows
- Repository: `kenken64/remotion-3d-AI-avatar`
- External APIs: OpenAI Chat Completions, OpenAI Audio (TTS + Whisper)
- Render framework: Remotion 4
