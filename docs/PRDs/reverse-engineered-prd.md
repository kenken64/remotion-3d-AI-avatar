# Reverse-Engineered PRD

| Field | Value |
|---|---|
| Product | Mona Lau AI Avatar |
| Source of Truth | Current implementation in this repository |
| Document Type | Reverse-engineered product requirements |
| Last Updated | 2026-04-27 |
| Status | Derived from shipped behavior |

## 1. Product Summary

Mona Lau AI Avatar is a browser-based conversational avatar experience that combines a real-time 3D character, chat, speech synthesis, speech transcription, wake-word interaction, webcam-assisted vision prompts, and an offline Remotion rendering path. The implemented product is positioned as a self-hostable demo or starter app for interactive AI avatar experiences rather than a multi-tenant production platform.

The core user promise is simple: a user can talk or type to an on-screen avatar and receive short spoken responses with synchronized facial animation, subtitles, and optional visual outputs such as generated images.

## 2. Problem Being Solved

The product addresses the gap between plain text chatbots and richer avatar interfaces. It gives builders a working reference for:

- Voice and text conversations with a visible character.
- Lip-synced spoken responses rather than text-only answers.
- Lightweight multimodal interactions, including webcam scene description and image generation.
- A browser-first implementation that can also render pre-scripted avatar output offline.

## 3. Target Users

### Primary Users

- Developers prototyping AI avatar interfaces.
- Demo creators who want a presentable conversational character quickly.
- Technical teams exploring multimodal UX with speech, webcam, and image generation.
- Content creators who want a simple Remotion-based avatar render pipeline.

### Secondary Users

- Internal innovation teams building kiosk, assistant, or character-driven concepts.
- Learners studying React, Three.js, Remotion, and OpenAI integration patterns.

## 4. Core Product Pillars

- Conversational avatar: the main experience centers on short-form back-and-forth dialogue with a named assistant persona, Mona Lau.
- Voice-first interaction: the app supports direct recording, hold-to-talk behavior, and wake-word-triggered interaction.
- Multimodal assistance: the app can describe webcam imagery and return generated images when a request looks like an image-generation prompt.
- Presentable visual experience: the product emphasizes a polished avatar scene, subtitles, status overlays, and chat history.
- Builder-friendly architecture: the system is designed to run locally with minimal setup and clear separation between frontend, backend, and rendering modes.

## 5. User Scenarios

### Scenario 1: Text Chat

The user types a message into the chat field. The system sends the conversation to the backend, receives a short response, synthesizes speech, animates the avatar mouth, reveals subtitles during playback, and stores the response in chat history.

### Scenario 2: Tap or Hold to Speak

The user records speech from the microphone. The system transcribes the audio, sends the resulting text through the normal chat path, and replies with spoken avatar output.

### Scenario 3: Wake-Word Interaction

The user enables wake-word mode and says phrases like “hey mona.” The app starts voice capture without requiring a button press.

### Scenario 4: Webcam Vision Prompt

The user enables the webcam and uses supported spoken phrases such as “what do you see.” The app captures the current webcam frame, sends it to a vision-capable model, and returns a short spoken description.

### Scenario 5: Image Request

The user asks for an image in English or Chinese using supported request patterns. The system generates the image, returns a short spoken acknowledgement, and shows the image in the chat thread.

### Scenario 6: Offline Video Render

The builder opens Remotion Studio or renders a composition to MP4 using the repository’s offline rendering path.

## 6. Functional Requirements

### 6.1 Avatar Experience

- The application must render a real-time 3D avatar in the browser.
- The default framing must present a head-and-shoulders composition rather than a full-body view.
- The avatar must support mouth animation driven by viseme states.
- The avatar must show idle motion when not speaking.
- The avatar must support blink animation independent of speaking.
- The background must include a stylized space scene with an aurora image backdrop, stars, and moving meteor effects.
- The avatar scene must support both desktop and mobile camera framing.

### 6.2 Chat Experience

- The user must be able to type text messages.
- The system must preserve conversation history across page reloads using browser local storage.
- The chat view must show timestamps and separate user and avatar message styling.
- The avatar’s replies must support replayable audio.
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
- Wake-word mode must listen for phrases equivalent to “hey mona,” including common speech-recognition mishearings.
- Wake-word mode must ignore triggers while the avatar is busy recording, transcribing, thinking, or speaking.
- Wake-word mode must restart automatically after each recognition session where browser support permits.

### 6.5 Webcam and Vision

- The user must be able to enable and disable a webcam preview.
- When enabled, the webcam preview must appear as an inset panel over the avatar scene.
- The system must be able to capture the current webcam frame and submit it to a vision-capable model.
- Vision prompts must result in a short spoken reply and chat history entry.
- The typed text field must remain text-only; webcam capture is a separate explicit or wake-phrase-driven path.

### 6.6 Image Generation

- The system must detect likely image-generation requests from the latest user message.
- The system must support both English and Chinese request heuristics.
- When an image request is detected, the backend must generate an image and return its URL with the assistant reply.
- The frontend must display returned images inline in the chat thread.
- The user must be able to open the image in a new tab.

### 6.7 Audio and Lip Sync

- Avatar speech must be generated from backend text using text-to-speech.
- Lip sync must be driven from the actual audio playback clock, not a fixed timer.
- Subtitle reveal must stay aligned to audio progression.
- The user must be able to mute and unmute live and replayed audio.
- When muted, spoken playback state should continue without audible output.

### 6.8 Language Behavior

- The backend must detect whether the latest user message contains Chinese characters.
- The assistant must reply in Simplified Mandarin when the latest user message is Chinese.
- The assistant must reply in English when the latest user message is not Chinese.
- Speech transcription must attempt both English and Chinese decoding and select the more confident result.

### 6.9 Layout and Device Behavior

- Desktop must provide a split layout with avatar scene and chat panel.
- Mobile must prioritize avatar visibility and present chat in a bottom sheet.
- The user must be able to hide and restore chat.
- The experience must support full-screen mode.
- Double click on desktop and double tap on mobile should be usable to enter or exit full screen.

### 6.10 External Input and Integration

- The backend must expose a polling-compatible message injection path for external clients.
- External systems must be able to enqueue a text message through an HTTP endpoint.
- The frontend must poll for injected messages and feed them into the same send-message flow as local user input.

### 6.11 Offline Rendering

- The repository must support a Remotion composition for pre-rendered avatar output.
- The offline rendering path may use a different avatar representation from the live 3D experience.
- The composition must accept text input and generate timed mouth animation for rendered video.

## 7. User Interface Requirements

### Header and Control Surface

The desktop chat header must expose controls for:

- Switching between chat and push-to-talk modes.
- Showing or hiding the webcam.
- Enabling or disabling wake-word mode.
- Muting or unmuting avatar audio.
- Entering or exiting full-screen mode.
- Hiding the chat panel.
- Clearing conversation history.

### Conversation UI

- Avatar messages must identify the Mona Lau speaker.
- User messages must display generated or captured images when present.
- The UI must show typing-style feedback while awaiting an avatar response.
- The UI must expose a replay control on avatar messages that include synthesized audio.

### Speaking and Status UI

- The avatar panel must show overlays for listening, transcribing, thinking, and speaking.
- Spoken subtitles must appear over the avatar scene during live playback.
- The webcam preview must not obstruct the avatar’s face framing.

## 8. Backend Requirements

### Required Endpoints

| Endpoint | Method | Behavior |
|---|---|---|
| `/api/chat` | POST | Accepts conversation history, enforces short persona replies, applies language rules, and optionally triggers image generation. |
| `/api/tts` | POST | Converts assistant text to MP3 audio. |
| `/api/transcribe` | POST | Accepts recorded audio and returns transcribed text. |
| `/api/vision` | POST | Accepts a webcam image and returns a concise description. |
| `/api/image` | POST | Generates an image from a prompt. |
| `/api/inject` | POST | Queues external messages for the browser app. |
| `/api/poll` | GET | Returns queued injected messages to polling clients. |

### Backend Behavior

- The backend must keep AI credentials server-side.
- The backend must accept JSON bodies large enough for base64-encoded media payloads.
- The backend must support environments where the `/api` prefix is stripped before the request reaches the server.
- Chat and vision responses must be concise because they are intended for spoken playback.

## 9. Non-Functional Requirements

- The product should run locally with a small number of environment variables.
- The browser experience should feel responsive enough for conversational turn-taking.
- The visual scene should remain stable and legible on modern desktop and mobile browsers.
- The app should degrade gracefully when browser capabilities such as webcam, mic, device motion, or speech recognition are unavailable.
- The system should not depend on database infrastructure for core operation.

## 10. Constraints and Known Product Boundaries

- The product is effectively single-user and session-scoped.
- The live experience and offline Remotion output use different avatar pipelines.
- Wake-word behavior depends on browser support for the Web Speech API.
- The vision path is separate from typed text input and requires webcam availability.
- Current image-request detection is heuristic-based rather than intent-classifier-based.
- The repository is optimized for demoability and hackability over enterprise hardening.

## 11. Primary Success Criteria

- A new user can start a local instance and have a spoken avatar conversation with minimal setup.
- The avatar appears visually presentable enough for demos without additional design work.
- Text, voice, webcam vision, and image-generation interactions all resolve through a single coherent chat surface.
- Builders can reuse the codebase as a reference implementation for their own avatar products.

## 12. Likely Future Requirements Implied by the Current Product

- Persistent server-side chat history or user accounts.
- Better intent handling for image and vision prompts.
- Streaming speech for lower response latency.
- More robust mobile and browser compatibility handling.
- Better observability, authentication, and rate limiting for exposed endpoints.
- A unified avatar asset strategy between live mode and Remotion rendering.
