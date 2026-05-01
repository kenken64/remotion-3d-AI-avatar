# Reverse-Engineered PRD

| Field | Value |
|---|---|
| Product | kenken64 AI Avatar |
| Source of Truth | Current implementation in this repository |
| Document Type | Reverse-engineered product requirements |
| Last Updated | 2026-05-01 |
| Status | Derived from shipped behavior |

## 1. Product Summary

kenken64 AI Avatar is a browser-based conversational avatar experience that combines a real-time 3D character, chat, speech synthesis, speech transcription, wake-word interaction, webcam-assisted vision prompts, a freehand drawing pad with vision-based interpretation, microphone-based song identification, on-demand bilingual translation, and an offline Remotion rendering path. The implemented product is positioned as a self-hostable demo or starter app for interactive AI avatar experiences rather than a multi-tenant production platform.

The core user promise is simple: a user can talk, type, sketch, or play music to an on-screen avatar and receive short spoken responses with synchronized facial animation, subtitles, and optional visual outputs such as generated images.

## 2. Problem Being Solved

The product addresses the gap between plain text chatbots and richer avatar interfaces. It gives builders a working reference for:

- Voice and text conversations with a visible character.
- Lip-synced spoken responses rather than text-only answers.
- Lightweight multimodal interactions, including webcam scene description, freehand sketch interpretation, song identification, and image generation.
- A browser-first implementation that can also render pre-scripted avatar output offline.

## 3. Target Users

### Primary Users

- Developers prototyping AI avatar interfaces.
- Demo creators who want a presentable conversational character quickly.
- Technical teams exploring multimodal UX with speech, webcam, drawing, audio capture, and image generation.
- Content creators who want a simple Remotion-based avatar render pipeline.

### Secondary Users

- Internal innovation teams building kiosk, assistant, or character-driven concepts.
- Learners studying React, Three.js, Remotion, and OpenAI integration patterns.

## 4. Core Product Pillars

- Conversational avatar: the main experience centers on short-form back-and-forth dialogue with a named assistant persona, kenken64.
- Voice-first interaction: the app supports direct recording, hold-to-talk behavior, and wake-word-triggered interaction.
- Multimodal assistance: the app can describe webcam imagery, interpret freehand sketches, identify recorded music, translate any chat bubble between English and Mandarin, and return generated images when a request looks like an image-generation prompt.
- Presentable visual experience: the product emphasizes a polished avatar scene with idle motion, a configurable gesture library, blink, and lip-sync; subtitles; status overlays; and chat history with markdown rendering.
- Builder-friendly architecture: the system is designed to run locally with minimal setup and clear separation between frontend, backend, and rendering modes.

## 5. User Scenarios

### Scenario 1: Text Chat

The user types a message into the chat field. The system sends the conversation to the backend, receives a short response (rendered as markdown when applicable), synthesizes speech, animates the avatar mouth, reveals subtitles during playback, and stores the response in chat history.

### Scenario 2: Tap or Hold to Speak

The user records speech from the microphone. The system transcribes the audio, sends the resulting text through the normal chat path, and replies with spoken avatar output.

### Scenario 3: Wake-Word Interaction

The user enables wake-word mode and says phrases like "hey kenken." The app starts voice capture without requiring a button press.

### Scenario 4: Webcam Vision Prompt

The user enables the webcam and either presses an on-preview shutter button or uses supported spoken phrases such as "what do you see." The app captures the current webcam frame, sends it to a vision-capable model, and returns a short spoken description.

### Scenario 5: Image Request

The user asks for an image in English or Chinese using supported request patterns. The system generates the image, returns a short spoken acknowledgement, and shows the image in the chat thread.

### Scenario 6: Drawing Pad / "Show kenken64"

The user opens the drawing pad, sketches with selectable colors and an eraser, and submits the canvas. The avatar receives the sketch via the vision endpoint in a sketch-styled prompt mode and replies with a short, playful guess about what was drawn.

### Scenario 7: Music Guess

The user starts a music-listen session that records up to twelve seconds of audio (or until the user stops it). The system transcribes any lyrics, returns the avatar's guess of the song, and falls back to a genre or mood description when the audio is instrumental.

### Scenario 8: Translation Toggle

The user taps a translate control on any chat bubble. The system auto-detects whether the source is English or Chinese and returns the opposite-language translation, displayed as a dimmed italic row beneath the original message. The translation is cached per message and can be toggled on and off.

### Scenario 9: Camera Zoom

The user adjusts a floating zoom pill to push the camera closer or pull back, including reset, while the authored framing target and field of view stay fixed.

### Scenario 10: Manual Gestures

The user presses a digit key (1–0) to trigger a specific gesture (wave, stretch, cheer, shrug, akimbo, point, clap, bow, nod, spin) without affecting the chat flow.

### Scenario 11: Offline Video Render

The builder opens Remotion Studio or renders a composition to MP4 using the repository's offline rendering path.

## 6. Functional Requirements

### 6.1 Avatar Experience

- The application must render a real-time 3D avatar in the browser.
- The default framing must present a head-and-shoulders composition rather than a full-body view.
- The avatar must support mouth animation driven by viseme states. When the underlying GLB carries Oculus phoneme visemes, the system must use them; otherwise it must fall back to a curated ARKit blendshape pose so the mouth still shapes phonemes visibly.
- The avatar must show idle motion (subtle sway, breathing, arm bob) when not speaking.
- The avatar must support blink animation independent of speaking.
- The avatar must support a library of named gestures: wave, stretch, cheer, shrug, akimbo, point, clap, bow, nod, spin. Bow and nod must bend at the spine and head bones rather than rotating the whole group. Spin must use cubic ease-in-out with a vertical bob and ballerina arms-out pose.
- The system must auto-schedule gentle gestures (currently wave and stretch) at randomized intervals.
- The user must be able to manually trigger any gesture using digit keys 1 through 0, with input ignored when focus is on a textarea or input field.
- The background must include a stylized space scene with an aurora image backdrop, stars, and moving meteor effects.
- The avatar scene must support both desktop and mobile camera framing.
- The scene must show a centered Suspense progress card while the avatar GLB is loading.
- The avatar GLB must be shipped in a compressed form using WebP textures and KHR_mesh_quantization to reduce download size while preserving topology, skinning, and morph targets.

### 6.2 Chat Experience

- The user must be able to type text messages.
- The system must preserve conversation history across page reloads using browser local storage.
- The system must guarantee unique chat-message ids, including across page reloads where prior data may contain duplicates.
- The chat view must show timestamps and separate user and avatar message styling.
- Avatar replies must render through a markdown-aware component that uses GitHub-flavored markdown when markers are detected and falls back to plain whitespace-preserving text otherwise. User messages remain plain.
- The avatar's replies must support replayable audio. Replaying audio from a chat bubble must drive the same lip-sync state machine as the live spoken reply.
- Each chat bubble must expose a translate control that toggles a cached EN ↔ ZH translation row beneath the original.
- The user must be able to clear conversation history from the UI.
- The app must show empty-state guidance when no messages exist.

### 6.3 Voice Interaction

- The user must be able to start and stop microphone recording from the UI.
- The app must support a push-to-talk mode with a large hold-to-talk affordance.
- The recording flow must provide visual state feedback for listening, transcribing, thinking, and speaking.
- The app must stop recordings automatically after prolonged silence or after a maximum recording duration.
- The app should provide light haptic and audio feedback when recording starts and stops on supported devices.
- The app must support shake-to-start recording on mobile devices when supported by the browser.

### 6.4 Wake-Word Behavior

- The user must be able to enable and disable wake-word mode.
- Wake-word mode must listen for phrases equivalent to "hey kenken," accepting common speech-recognition mishearings of the name (ken, kenn, kenny, kent, kenken, kenken64). The trigger drops the trailing digits because speech recognition cannot reliably transcribe them.
- Wake-word mode must ignore triggers while the avatar is busy recording, transcribing, thinking, or speaking.
- Wake-word mode must restart automatically after each recognition session where browser support permits.

### 6.5 Webcam and Vision

- The user must be able to enable and disable a webcam preview from the floating scene-controls pill.
- When enabled, the webcam preview must appear as an inset panel over the avatar scene and must not obstruct the avatar's face framing.
- The system must be able to capture the current webcam frame and submit it to a vision-capable model.
- The webcam preview must expose a click-to-capture shutter button that triggers the same vision flow as the wake-phrase path. The shutter must be disabled while thinking, speaking, recording, or transcribing.
- Vision prompts must result in a short spoken reply and chat history entry.
- The typed text field must remain text-only; webcam capture is a separate explicit or wake-phrase-driven path.

### 6.6 Drawing Pad

- The user must be able to enable and disable a drawing pad overlay from the floating scene-controls pill.
- The pad must support pointer drawing, color swatch selection, an eraser, and a clear action.
- The pad must expose a "Show kenken64" submit action that sends the rendered canvas to the vision endpoint with a sketch-style prompt mode.
- The avatar must respond with a short, playful guess about the drawing.

### 6.7 Music Identification

- The user must be able to start a music-listen session from the floating scene-controls pill.
- A session must capture up to twelve seconds of microphone audio, with a click-to-stop affordance.
- The captured audio must be sent to a music-guessing endpoint that transcribes lyrics and returns the avatar's guess of the song.
- For instrumental or unrecognized audio, the response must fall back to a short genre or mood description.

### 6.8 Translation

- Each chat bubble must have a translate control.
- The system must auto-detect direction by checking the source for Han characters: Chinese sources translate to English, all other sources translate to Simplified Mandarin.
- Translations must be cached per message so toggling does not trigger repeated API calls.
- Translations must render as a dimmed italic row beneath the original text.

### 6.9 Image Generation

- The system must detect likely image-generation requests from the latest user message.
- The system must support both English and Chinese request heuristics.
- When an image request is detected, the backend must generate an image and return its URL with the assistant reply.
- The frontend must display returned images inline in the chat thread.
- The user must be able to open the image in a new tab.

### 6.10 Audio and Lip Sync

- Avatar speech must be generated from backend text using text-to-speech with a male default voice (`onyx`).
- Lip sync must be driven from the actual audio playback clock, not a fixed timer.
- Subtitle reveal must stay aligned to audio progression.
- The user must be able to mute and unmute live and replayed audio.
- When muted, spoken playback state should continue without audible output.
- Replaying a chat-bubble's stored audio must produce the same viseme animation as the original utterance.

### 6.11 Language Behavior

- The backend must detect whether the latest user message contains Chinese characters.
- The assistant must reply in Simplified Mandarin when the latest user message is Chinese.
- The assistant must reply in English when the latest user message is not Chinese.
- Speech transcription must attempt both English and Chinese decoding and select the more confident result.

### 6.12 Layout, Scene Controls, and Device Behavior

- Desktop must provide a split layout with avatar scene and chat panel.
- Mobile must prioritize avatar visibility and present chat in a bottom sheet.
- The user must be able to hide and restore chat.
- The experience must support full-screen mode.
- Double click on desktop and double tap on mobile should be usable to enter or exit full screen.
- A floating top-left pill on the avatar scene must group webcam, drawing pad, and music-listen toggles, keeping them out of the chat header.
- A floating bottom-left pill on the avatar scene must expose camera zoom controls (+, –, reset) bounded to a 0.2–2.5 multiplier. Zoom must scale only camera distance, leaving the authored framing target and field of view unchanged.

### 6.13 External Input and Integration

- The backend must expose a polling-compatible message injection path for external clients.
- External systems must be able to enqueue a text message through an HTTP endpoint.
- The frontend must poll for injected messages and feed them into the same send-message flow as local user input.

### 6.14 Offline Rendering

- The repository must support a Remotion composition for pre-rendered avatar output.
- The offline rendering path may use a different avatar representation from the live 3D experience.
- The composition must accept text input and generate timed mouth animation for rendered video.

## 7. User Interface Requirements

### Header and Control Surface

The desktop chat header must expose controls for:

- Switching between chat and push-to-talk modes.
- Enabling or disabling wake-word mode.
- Muting or unmuting avatar audio.
- Entering or exiting full-screen mode.
- Hiding the chat panel.
- Clearing conversation history.

Webcam, drawing pad, and music-listen toggles are surfaced separately as a floating scene-controls pill on the avatar panel rather than in the chat header.

### Conversation UI

- Avatar messages must identify the kenken64 speaker.
- User messages must display generated or captured images when present.
- Avatar message text must render as markdown when markdown markers are detected.
- The UI must show typing-style feedback while awaiting an avatar response.
- The UI must expose a replay control on avatar messages that include synthesized audio.
- The UI must expose a translation toggle on every chat bubble.

### Speaking and Status UI

- The avatar panel must show overlays for listening, transcribing, thinking, and speaking.
- Spoken subtitles must appear over the avatar scene during live playback.
- The webcam preview must not obstruct the avatar's face framing.
- A Suspense progress card must appear in place of the avatar while the GLB is loading.

## 8. Backend Requirements

### Required Endpoints

| Endpoint | Method | Behavior |
|---|---|---|
| `/api/chat` | POST | Accepts conversation history, enforces short persona replies, applies language rules, and optionally triggers image generation. Bypasses any external gateway and calls the upstream model service directly. |
| `/api/tts` | POST | Converts assistant text to MP3 audio. Default voice is male (`onyx`). |
| `/api/transcribe` | POST | Accepts recorded audio and returns transcribed text. |
| `/api/vision` | POST | Accepts a webcam image or sketch canvas and returns a concise description. Supports a `mode=sketch` parameter that switches the system prompt to a playful guessing style. |
| `/api/image` | POST | Generates an image from a prompt. |
| `/api/translate` | POST | Returns a translation of supplied text in the opposite EN/ZH direction; called per chat bubble on demand. |
| `/api/guess-music` | POST | Accepts up to twelve seconds of recorded audio, transcribes any lyrics, and returns the avatar's song guess; falls back to a genre/mood description for instrumentals. |
| `/api/inject` | POST | Queues external messages for the browser app. |
| `/api/poll` | GET | Returns queued injected messages to polling clients. |

### Backend Behavior

- The backend must keep AI credentials server-side.
- The backend must accept JSON bodies large enough for base64-encoded media payloads.
- The backend must support environments where the `/api` prefix is stripped before the request reaches the server.
- Chat and vision responses must be concise because they are intended for spoken playback.
- The chat path must minimize round-trip latency by calling the upstream model service directly rather than routing through additional gateways.

## 9. Non-Functional Requirements

- The product should run locally with a small number of environment variables.
- The browser experience should feel responsive enough for conversational turn-taking; chat round-trips should be in the seconds, not tens of seconds.
- The visual scene should remain stable and legible on modern desktop and mobile browsers.
- The app should degrade gracefully when browser capabilities such as webcam, mic, device motion, or speech recognition are unavailable.
- The avatar GLB should load fast enough on typical broadband that the Suspense card is brief; texture and mesh compression are part of meeting this target.
- The system should not depend on database infrastructure for core operation.

## 10. Constraints and Known Product Boundaries

- The product is effectively single-user and session-scoped.
- The live experience and offline Remotion output use different avatar pipelines.
- Wake-word behavior depends on browser support for the Web Speech API.
- The vision, drawing, and music-listen paths are separate from typed text input and require their respective device capabilities (webcam, pointer, microphone).
- Current image-request detection is heuristic-based rather than intent-classifier-based.
- The translation feature relies on Han-character regex detection rather than full language identification.
- Speech-recognition limitations require the wake phrase to use a pronounceable form ("hey kenken") rather than the full product name with digits.
- The repository is optimized for demoability and hackability over enterprise hardening.

## 11. Primary Success Criteria

- A new user can start a local instance and have a spoken avatar conversation with minimal setup.
- The avatar appears visually presentable enough for demos without additional design work, including idle motion, blink, lip sync, and a varied gesture library.
- Text, voice, webcam vision, drawing-pad sketch, music-guess, translation, and image-generation interactions all resolve through a single coherent chat surface.
- Builders can reuse the codebase as a reference implementation for their own avatar products.

## 12. Likely Future Requirements Implied by the Current Product

- Persistent server-side chat history or user accounts.
- Better intent handling for image, vision, and music prompts.
- Streaming speech for lower response latency.
- More robust mobile and browser compatibility handling.
- Better observability, authentication, and rate limiting for exposed endpoints.
- A unified avatar asset strategy between live mode and Remotion rendering.
- Replacing the regex-based language and intent detectors with proper classifiers.
