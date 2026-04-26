import React, {useState, useRef, useEffect, useCallback, useMemo} from 'react';
import {Avatar3D} from '../Avatar3D';
import {useAudioLipSync} from './useAudioLipSync';
import {sendChatMessage, fetchSpeechAudio, transcribeAudio, ChatMsg} from './api';
import {AvatarIcon} from './AvatarIcon';
import type {MouthShape} from '../lipSync';

const MOBILE_BREAKPOINT = 768;

const useIsMobile = (): boolean => {
  const getMatch = () => {
    if (typeof window === 'undefined') return false;
    try {
      const m = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      return m.matches;
    } catch {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }
  };

  const [isMobile, setIsMobile] = useState(getMatch);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile('matches' in e ? e.matches : mql.matches);
    // Attach listener with fallback for older browsers
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange as any);
      return () => mql.removeEventListener('change', onChange as any);
    }
    // @ts-ignore fallback
    mql.addListener(onChange as any);
    // @ts-ignore fallback cleanup
    return () => mql.removeListener(onChange as any);
  }, []);

  return isMobile;
};

interface ChatMessage {
  id: number;
  text: string;
  sender: 'user' | 'avatar';
  timestamp: Date;
  audioUrl?: string; // object URL for TTS audio replay
  imageUrl?: string; // generated image URL (e.g. DALL-E)
}

export const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('avatar-chat-history');
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        return parsed.map(m => ({...m, timestamp: new Date(m.timestamp)}));
      }
    } catch { /* ignore */ }
    return [];
  });
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [breatheY, setBreatheY] = useState(0);
  const [playingMsgId, setPlayingMsgId] = useState<number | null>(null);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [panelMode, setPanelMode] = useState<'chat' | 'ptt'>('chat');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const chatShownAtRef = useRef<number>(0);
  const replayAudioRef = useRef<HTMLAudioElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(messages.length);
  const conversationRef = useRef<ChatMsg[]>(
    messages.map(m => ({role: m.sender === 'user' ? 'user' : 'assistant', content: m.text}))
  );
  const breatheRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const {mouthShape, isSpeaking, spokenText, currentSpeech, speak, setMuted} =
    useAudioLipSync();

  const isMobile = useIsMobile();
  const styles = useMemo(() => buildStyles(isMobile), [isMobile]);

  // keyboard shortcut to show chat if it was hidden (press 'c')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') setIsChatVisible(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // fullscreen change handler
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // hide chat by default on mobile to keep avatar visible
  useEffect(() => {
    if (isMobile) {
      setIsChatVisible(false);
      setMobileSheetOpen(false);
    }
  }, [isMobile]);

  // double-tap helper ref for mobile fullscreen
  const lastTapRef = useRef<number>(0);

const toggleFullscreen = useCallback(() => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
        // hide chat when entering fullscreen for an immersive view
        setIsChatVisible(false);
        setMobileSheetOpen(false);
      } else {
        document.exitFullscreen?.();
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed', err);
    }
  }, []);

  // Keep a stable ref so the poll handler always calls the latest sendMessage
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  // Polling bridge: poll the server for injected messages (HTTP fallback)
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch('/remotion/api/poll');
        if (!res.ok) {
          if (mounted) setTimeout(poll, 1000);
          return;
        }
        const j = await res.json();
        if (j.messages && j.messages.length) {
          j.messages.forEach((m: string) => sendMessageRef.current(m));
        }
      } catch (e) {
        // ignore transient errors
      }
      if (mounted) setTimeout(poll, 1000);
    };
    poll();
    return () => { mounted = false; };
  }, []);

  // Sync mute state into the lip-sync hook so a live in-progress audio
  // element gets muted immediately and future speak() calls start muted.
  useEffect(() => {
    setMuted(isMuted);
    if (replayAudioRef.current) {
      replayAudioRef.current.muted = isMuted;
    }
  }, [isMuted, setMuted]);

  // Idle mouth when not speaking
  const [idleMouth, setIdleMouth] = useState<MouthShape>('closed');

  useEffect(() => {
    if (isSpeaking) return;
    const interval = setInterval(() => {
      const shapes: MouthShape[] = ['closed', 'closed', 'closed', 'M', 'closed'];
      setIdleMouth(shapes[Math.floor(Math.random() * shapes.length)]);
    }, 2500);
    return () => clearInterval(interval);
  }, [isSpeaking]);

  // Breathing animation
  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      breatheRef.current += 1;
      setBreatheY(Math.sin(breatheRef.current * 0.04) * 2);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      running = false;
    };
  }, []);

  // Persist chat history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('avatar-chat-history', JSON.stringify(messages));
    } catch { /* ignore quota errors */ }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isThinking || isSpeaking) return;

    setMessages((prev) => [
      ...prev,
      {
        id: ++messageIdRef.current,
        text,
        sender: 'user',
        timestamp: new Date(),
      },
    ]);

    conversationRef.current.push({role: 'user', content: text});
    setIsThinking(true);

    try {
      const {reply, imageUrl} = await sendChatMessage(conversationRef.current);
      conversationRef.current.push({role: 'assistant', content: reply});

      const audioBlob = await fetchSpeechAudio(reply);
      const audioUrl = URL.createObjectURL(audioBlob);
      setIsThinking(false);

      await speak(reply, audioBlob);

      setMessages((prev) => [
        ...prev,
        {
          id: ++messageIdRef.current,
          text: reply,
          sender: 'avatar',
          timestamp: new Date(),
          audioUrl,
          imageUrl,
        },
      ]);
    } catch (err) {
      console.error('Error:', err);
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          id: ++messageIdRef.current,
          text: 'Sorry, something went wrong. Please try again.',
          sender: 'avatar',
          timestamp: new Date(),
        },
      ]);
    }
  }, [isThinking, isSpeaking, speak]);

  // Keep ref in sync so the stable WS effect always calls the latest sendMessage
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setInputText('');
    sendMessage(trimmed);
  }, [inputText, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Toggle mic recording: click to start, click again to stop
  const toggleRecording = useCallback(async () => {
    // small beep helper
    const playBeep = (freq = 600, duration = 0.06) => {
      try {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        if (!Ctx) return;
        const ctx = new Ctx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.value = 0.0015;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
        setTimeout(() => { try { o.stop(); ctx.close(); } catch (e) {} }, duration * 1000 + 20);
      } catch (e) { /* ignore audio errors */ }
    };

    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
        setIsRecording(false);
        // feedback
        navigator.vibrate?.(40);
        playBeep(420, 0.06);
      }
      return;
    }

    if (isThinking || isSpeaking || isTranscribing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      const mediaRecorder = new MediaRecorder(stream, {mimeType: 'audio/webm'});
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, {type: 'audio/webm'});

        if (audioBlob.size < 1000) return;

        setIsTranscribing(true);
        try {
          const text = await transcribeAudio(audioBlob);
          setIsTranscribing(false);
          if (text.trim()) {
            sendMessage(text.trim());
          }
        } catch (err) {
          console.error('Transcription error:', err);
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      // feedback
      navigator.vibrate?.(20);
      playBeep(780, 0.06);

      // Silence detection: stop recording after sustained silence
      try {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        if (Ctx) {
          const audioCtx = new Ctx();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);
          const buf = new Uint8Array(analyser.fftSize);
          const SILENCE_RMS = 0.02;
          const SILENCE_MS = 1500;
          const MAX_MS = 15000;
          const startedAt = Date.now();
          let lastVoiceAt = 0;
          let voiceHeard = false;
          const tick = () => {
            if (mediaRecorderRef.current !== mediaRecorder) {
              try { audioCtx.close(); } catch {}
              return;
            }
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            const now = Date.now();
            if (rms > SILENCE_RMS) {
              voiceHeard = true;
              lastVoiceAt = now;
            }
            const elapsed = now - startedAt;
            const sinceVoice = now - lastVoiceAt;
            const shouldStop =
              elapsed > MAX_MS ||
              (voiceHeard && sinceVoice > SILENCE_MS);
            if (shouldStop) {
              try { audioCtx.close(); } catch {}
              if (mediaRecorderRef.current === mediaRecorder) {
                try { mediaRecorder.stop(); } catch {}
                mediaRecorderRef.current = null;
                setIsRecording(false);
                navigator.vibrate?.(40);
                playBeep(420, 0.06);
              }
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      } catch (e) { /* ignore audio analyser errors */ }
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  }, [isRecording, isThinking, isSpeaking, isTranscribing, sendMessage]);

  // shake-to-start: detect device motion shakes and start mic (mobile)
  useEffect(() => {
    if (!isMobile) return;
    let lastShake = 0;
    const handler = (ev: DeviceMotionEvent) => {
      const a = ev.accelerationIncludingGravity || ev.acceleration;
      if (!a) return;
      const x = a.x || 0; const y = a.y || 0; const z = a.z || 0;
      const mag = Math.sqrt(x * x + y * y + z * z);
      // threshold tuned empirically; ignore repeated shakes within 1.5s
      if (mag > 22 && Date.now() - lastShake > 1500) {
        lastShake = Date.now();
        if (!isRecording) toggleRecording();
      }
    };
    window.addEventListener('devicemotion', handler as EventListener);
    return () => window.removeEventListener('devicemotion', handler as EventListener);
  }, [isMobile, isRecording, toggleRecording]);

  // Capture current webcam frame and ask OpenClaw to describe it.
  const captureAndIdentify = useCallback(async () => {
    const video = webcamVideoRef.current;
    if (!webcamEnabled || !video || !video.videoWidth) {
      console.warn('captureAndIdentify: webcam not ready');
      return;
    }
    if (isThinking || isSpeaking || isRecording || isTranscribing) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    setMessages((prev) => [
      ...prev,
      {
        id: ++messageIdRef.current,
        text: 'What do you see?',
        sender: 'user',
        timestamp: new Date(),
        imageUrl: dataUrl,
      },
    ]);

    setIsThinking(true);
    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({imageBase64: dataUrl}),
      });
      if (!res.ok) throw new Error(`Vision failed: ${res.status}`);
      const {reply} = await res.json();
      conversationRef.current.push({role: 'user', content: 'What do you see?'});
      conversationRef.current.push({role: 'assistant', content: reply});

      const audioBlob = await fetchSpeechAudio(reply);
      const audioUrl = URL.createObjectURL(audioBlob);
      setIsThinking(false);
      await speak(reply, audioBlob);
      setMessages((prev) => [
        ...prev,
        {
          id: ++messageIdRef.current,
          text: reply,
          sender: 'avatar',
          timestamp: new Date(),
          audioUrl,
        },
      ]);
    } catch (err) {
      console.error('Vision error:', err);
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          id: ++messageIdRef.current,
          text: "Sorry, I couldn't analyze that image.",
          sender: 'avatar',
          timestamp: new Date(),
        },
      ]);
    }
  }, [webcamEnabled, isThinking, isSpeaking, isRecording, isTranscribing, speak]);

  // Webcam: acquire stream when enabled, release when disabled.
  useEffect(() => {
    if (!webcamEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {facingMode: 'user', width: {ideal: 480}, height: {ideal: 360}},
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        webcamStreamRef.current = stream;
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          webcamVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error('Webcam access denied:', err);
        if (!cancelled) setWebcamEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
      const s = webcamStreamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
      if (webcamVideoRef.current) webcamVideoRef.current.srcObject = null;
    };
  }, [webcamEnabled]);

  // Refs the wake listener uses to read live state without re-subscribing.
  // Without these, the dep array would churn on every breath-tick render
  // and the recognizer would tear down before it could finish a session.
  const wakeFlagsRef = useRef({isRecording, isTranscribing, isThinking, isSpeaking, webcamEnabled});
  wakeFlagsRef.current = {isRecording, isTranscribing, isThinking, isSpeaking, webcamEnabled};
  const toggleRecordingRef = useRef(toggleRecording);
  toggleRecordingRef.current = toggleRecording;
  const captureAndIdentifyRef = useRef(captureAndIdentify);
  captureAndIdentifyRef.current = captureAndIdentify;

  // Wake-word listener ("hey mona") via Web Speech API.
  // Mounted once per wakeEnabled toggle; ignores results when avatar is busy.
  useEffect(() => {
    if (!wakeEnabled) {
      console.log('[wake] disabled — listener not running');
      return;
    }
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn('[wake] SpeechRecognition not supported in this browser — use Chrome/Edge');
      return;
    }
    // Chrome's `continuous: true` is flaky — silently aborts in many setups
    // (browser extensions w/ SES, certain mic stacks). Single-shot sessions
    // with rapid restart are far more reliable for wake-word use.
    const recog = new SR();
    recog.continuous = false;
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.lang = 'en-US';
    let stopped = false;
    let triggered = false;
    let restartTimer: number | null = null;

    recog.onstart = () => {
      // Per-session reset so a previous trigger doesn't lock out future ones.
      triggered = false;
      console.log('[wake] listener started — say "hey Mona"');
    };
    recog.onaudiostart = () => console.log('[wake] mic capturing audio');
    recog.onspeechstart = () => console.log('[wake] speech detected');

    recog.onresult = (e: any) => {
      if (triggered) return;
      const flags = wakeFlagsRef.current;
      // Avatar busy → ignore results but keep recognizer alive.
      if (flags.isRecording || flags.isTranscribing || flags.isThinking || flags.isSpeaking) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript: string = e.results[i][0].transcript.toLowerCase();
        const isFinal = e.results[i].isFinal;
        console.log(`[wake] heard${isFinal ? ' (final)' : ' (interim)'}:`, transcript);
        // Vision wake phrases — capture webcam frame and identify.
        if (/(what (do|can) you see|look at (this|me)|identify (this|the object|what'?s here)|describe (this|the (image|scene|object)))/.test(transcript)) {
          if (flags.webcamEnabled) {
            triggered = true; // session-local; reset on next onstart
            captureAndIdentifyRef.current();
            return;
          }
          // webcam off — ignore so listener keeps running
        }
        // Talk wake phrase — accept common phonetic mishearings of "mona".
        if (/\b(hey|hi|ok)\s+(mona|moana|mauna|monah|moaner|moner|monna|munna)\b/.test(transcript)) {
          triggered = true; // session-local; reset on next onstart
          toggleRecordingRef.current();
          return;
        }
      }
    };
    recog.onerror = (e: any) => {
      console.warn('[wake] recognition error:', e.error);
    };
    recog.onend = () => {
      if (stopped) {
        console.log('[wake] listener stopped (cleanup)');
        return;
      }
      restartTimer = window.setTimeout(() => {
        try { recog.start(); } catch (err) { console.warn('[wake] restart failed:', err); }
      }, 100);
    };
    try {
      recog.start();
    } catch (e) {
      console.warn('[wake] initial start failed (likely needs a user gesture):', e);
    }

    return () => {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      try { recog.stop(); } catch {}
    };
  }, [wakeEnabled]);

  // Replay avatar audio
  const replayAudio = useCallback((msgId: number, audioUrl: string) => {
    if (playingMsgId === msgId) return; // already playing this one
    const audio = new Audio(audioUrl);
    audio.muted = isMuted;
    replayAudioRef.current = audio;
    setPlayingMsgId(msgId);
    audio.play();
    const clear = () => {
      if (replayAudioRef.current === audio) replayAudioRef.current = null;
      setPlayingMsgId(null);
    };
    audio.onended = clear;
    audio.onerror = clear;
  }, [playingMsgId, isMuted]);

  const activeMouth = isSpeaking ? mouthShape : idleMouth;

  return (
    <div style={styles.container}>
      {/* Left: 3D Avatar */}
      <div style={isChatVisible ? styles.avatarPanel : styles.avatarPanelFull}>
        <div
          style={{...styles.avatarScene, paddingTop: isMobile ? 'env(safe-area-inset-top)' : undefined}}
          onDoubleClick={() => toggleFullscreen()}
          onTouchStart={(e) => {
            // try to request motion permission on first user touch (iOS requirement)
            try {
              if (typeof (DeviceMotionEvent) !== 'undefined' && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
                (DeviceMotionEvent as any).requestPermission().catch(() => {});
              }
            } catch (err) {}

            const now = Date.now();
            if (now - (lastTapRef.current || 0) < 300) { toggleFullscreen(); lastTapRef.current = 0; }
            else { lastTapRef.current = now; }
          }}
        >
          <Avatar3D mouthShape={activeMouth} breatheY={breatheY} isSpeaking={isSpeaking} isMobile={isMobile} />

          {/* Webcam preview — corner panel; positioned away from avatar's face */}
          {webcamEnabled && (
            <div
              style={{
                position: 'absolute',
                right: isMobile ? 12 : 16,
                top: isMobile ? 12 : 16,
                width: isMobile ? 168 : 280,
                aspectRatio: '4 / 3',
                borderRadius: 12,
                overflow: 'hidden',
                background: '#000',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.12)',
                zIndex: 5,
              }}
            >
              <video
                ref={webcamVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                }}
              />
            </div>
          )}

          {/* Show-chat button — reloads the page so chat is always visible on load */}
          {!isChatVisible && (
            <button
              onClick={() => {
                if (isMobile) { setMobileSheetOpen(true); setIsChatVisible(true); }
                else { window.location.reload(); }
              }}
              style={styles.showChatButton}
              aria-label="Show chat panel"
              title="Show chat"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <div style={styles.recordingOverlay}>
              <div style={styles.recordingBubble}>
                <div style={styles.recordingPulse} />
                <span style={styles.recordingText}>Listening...</span>
              </div>
            </div>
          )}

          {/* Transcribing indicator */}
          {isTranscribing && (
            <div style={styles.thinkingOverlay}>
              <div style={{...styles.thinkingBubble, borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.15)'}}>
                <span style={{...styles.thinkingText, color: '#fbbf24'}}>Transcribing...</span>
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {isThinking && (
            <div style={styles.thinkingOverlay}>
              <div style={styles.thinkingBubble}>
                <div style={styles.thinkingDots}>
                  <span style={{...styles.dot, animationDelay: '0s'}}>.</span>
                  <span style={{...styles.dot, animationDelay: '0.2s'}}>.</span>
                  <span style={{...styles.dot, animationDelay: '0.4s'}}>.</span>
                </div>
                <span style={styles.thinkingText}>Thinking...</span>
              </div>
            </div>
          )}

          {/* Speaking indicator + subtitle */}
          {isSpeaking && (
            <div style={styles.speakingOverlay}>
              <div style={styles.speakingBadge}>
                <div style={styles.speakingDot} />
                <div style={{...styles.speakingDot, animationDelay: '0.15s'}} />
                <div style={{...styles.speakingDot, animationDelay: '0.3s'}} />
              </div>
            </div>
          )}

          {isSpeaking && spokenText && (
            <div style={styles.subtitleBar}>
              <div style={styles.subtitleInner}>
                <p style={styles.subtitleText}>
                  {spokenText}
                  <span style={styles.cursor}>|</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Chat Panel */}
      {isChatVisible && !isMobile && (
      <div style={styles.chatPanel}>
        <div style={styles.chatHeader}>
          <div
            style={{
              ...styles.headerDot,
              background: isRecording ? '#ef4444' : isTranscribing ? '#f59e0b' : isSpeaking ? '#f59e0b' : isThinking ? '#8b5cf6' : '#4ade80',
            }}
          />
          <AvatarIcon size={32} />
          <h2 style={styles.headerTitle}>Mona Lau</h2>
          <button
            onClick={() => setPanelMode((m) => (m === 'chat' ? 'ptt' : 'chat'))}
            style={{...styles.headerIconButton, marginLeft: 8}}
            title={panelMode === 'chat' ? 'Switch to push-to-talk' : 'Switch to chat'}
            aria-pressed={panelMode === 'ptt'}
          >
            {panelMode === 'chat' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1v22" />
                <circle cx="12" cy="7" r="3" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setWebcamEnabled((w) => !w)}
            style={{
              ...styles.headerIconButton,
              marginLeft: 'auto',
              ...(webcamEnabled ? styles.headerIconButtonActive : {}),
            }}
            aria-label={webcamEnabled ? 'Hide webcam' : 'Show webcam'}
            aria-pressed={webcamEnabled}
            title={webcamEnabled ? 'Hide webcam' : 'Show webcam'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
          <button
            onClick={() => setWakeEnabled((w) => !w)}
            style={{
              ...styles.headerIconButton,
              marginLeft: 8,
              ...(wakeEnabled ? styles.headerIconButtonActive : {}),
            }}
            aria-label={wakeEnabled ? 'Disable wake word' : 'Enable wake word ("hey mona")'}
            aria-pressed={wakeEnabled}
            title={wakeEnabled ? 'Wake word ON — say "hey mona"' : 'Enable wake word ("hey mona")'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 4v2" />
              <path d="M12 18v2" />
              <path d="M4 12h2" />
              <path d="M18 12h2" />
              <path d="M6.3 6.3l1.4 1.4" />
              <path d="M16.3 16.3l1.4 1.4" />
              <path d="M6.3 17.7l1.4-1.4" />
              <path d="M16.3 7.7l1.4-1.4" />
            </svg>
          </button>
          <button
            onClick={() => setIsMuted((m) => !m)}
            style={{
              ...styles.headerIconButton,
              marginLeft: 8,
              ...(isMuted ? styles.headerIconButtonActive : {}),
            }}
            aria-label={isMuted ? 'Unmute avatar' : 'Mute avatar'}
            aria-pressed={isMuted}
            title={isMuted ? 'Unmute avatar' : 'Mute avatar'}
          >
            {isMuted ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
          <button
            onClick={toggleFullscreen}
            style={{...styles.headerIconButton, marginLeft: 8}}
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 9H5V5" />
                <path d="M15 15h4v4" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 7H3v4" />
                <path d="M17 17h4v-4" />
              </svg>
            )}
          </button>
          <button
            onClick={() => { if (Date.now() - chatShownAtRef.current > 500) setIsChatVisible(false); }}
            style={styles.headerIconButton}
            aria-label="Hide chat panel"
            title="Hide chat"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Clear conversation */}
          <button
            onClick={() => { setMessages([]); localStorage.removeItem('avatar-chat-history'); messageIdRef.current = 0; }}
            style={{...styles.headerIconButton, marginLeft: 8}}
            aria-label="Clear conversation"
            title="Clear conversation"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <span style={styles.headerSubtitle}>
            {isRecording
              ? 'Recording... click mic to stop'
              : isTranscribing
                ? 'Transcribing...'
                : isSpeaking
                  ? 'Speaking...'
                  : isThinking
                    ? 'Thinking...'
                    : 'Chat or hold mic to talk'}
          </span>
        </div>

        <div style={styles.chatMessages}>
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}><AvatarIcon size={56} /></div>
              <p style={styles.emptyText}>
                Say hello! Type a message and the AI avatar
                <br />
                will respond with voice and lip-sync.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.messageBubble,
                ...(msg.sender === 'user' ? styles.userMessage : styles.avatarMessage),
              }}
            >
              <div
                style={{
                  ...styles.messageContent,
                  ...(msg.sender === 'user' ? styles.userContent : styles.avatarContent),
                }}
              >
                {msg.sender === 'avatar' && (
                  <span style={styles.avatarMsgLabel}><AvatarIcon size={18} /> Mona Lau</span>
                )}
                {msg.sender === 'user' && (
                  <span style={styles.userMsgLabel}>You</span>
                )}
                <p style={styles.messageText}>{msg.text}</p>
                {msg.imageUrl && (
                  <a href={msg.imageUrl} target="_blank" rel="noreferrer">
                    <img
                      src={msg.imageUrl}
                      alt="generated"
                      style={{
                        marginTop: 8,
                        maxWidth: '100%',
                        borderRadius: 12,
                        display: 'block',
                      }}
                    />
                  </a>
                )}
                <div style={styles.messageFooter}>
                  {msg.sender === 'avatar' && msg.audioUrl && (
                    <button
                      onClick={() => replayAudio(msg.id, msg.audioUrl!)}
                      style={{
                        ...styles.replayButton,
                        ...(playingMsgId === msg.id ? styles.replayButtonPlaying : {}),
                      }}
                    >
                      {playingMsgId === msg.id ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      )}
                    </button>
                  )}
                  <span style={styles.timestamp}>
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {isThinking && (
            <div style={{...styles.messageBubble, ...styles.avatarMessage}}>
              <div style={{...styles.messageContent, ...styles.avatarContent}}>
                <span style={styles.avatarMsgLabel}><AvatarIcon size={18} /> Mona Lau</span>
                <div style={styles.typingIndicator}>
                  <div style={styles.typingDot} />
                  <div style={{...styles.typingDot, animationDelay: '0.15s'}} />
                  <div style={{...styles.typingDot, animationDelay: '0.3s'}} />
                </div>
                <div style={styles.messageFooter}>
                  <span style={styles.timestamp}>
                    {new Date().toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={styles.inputArea}>
          <div style={styles.inputWrapper}>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isSpeaking
                  ? 'Avatar is speaking...'
                  : isThinking
                    ? 'Waiting for response...'
                    : 'Type a message...'
              }
              style={styles.textarea}
              rows={1}
              disabled={isThinking || isSpeaking}
            />
            {/* Mic button — click to start, click again to stop */}
            <button
              onClick={toggleRecording}
              disabled={!isRecording && (isThinking || isSpeaking || isTranscribing)}
              style={{
                ...styles.micButton,
                ...(isRecording
                  ? styles.micButtonRecording
                  : isThinking || isSpeaking || isTranscribing
                    ? styles.micButtonDisabled
                    : styles.micButtonIdle),
              }}
            >
              {isRecording ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isThinking || isSpeaking}
              style={{
                ...styles.sendButton,
                ...(inputText.trim() && !isThinking && !isSpeaking
                  ? styles.sendButtonActive
                  : styles.sendButtonDisabled),
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

        {panelMode === 'ptt' && (
          <div style={styles.pttOverlay}>
            <div style={styles.pttInstructions}>Hold to talk</div>
            <button
              onMouseDown={() => { if (!isRecording) toggleRecording(); }}
              onMouseUp={() => { if (isRecording) toggleRecording(); }}
              onMouseLeave={() => { if (isRecording) toggleRecording(); }}
              onTouchStart={(e) => { e.preventDefault(); if (!isRecording) toggleRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); if (isRecording) toggleRecording(); }}
              style={styles.pttButton}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              </svg>
            </button>
          </div>
        )}
        </div>
      </div>
      )}

      {/* Mobile bottom sheet chat (swipe-up style) */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            height: mobileSheetOpen ? '70dvh' : '12vh',
            transition: 'height 260ms ease',
            zIndex: 20000,
            background: '#12121f',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* handle */}
          <div style={{width: '100%', display: 'flex', justifyContent: 'center', padding: 8}}>
            <div
              onClick={() => setMobileSheetOpen((s) => !s)}
              style={{width: 56, height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.08)', cursor: 'pointer'}}
            />
          </div>

          {/* sheet content */}
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
            <div style={{...styles.chatHeader, padding: '10px 14px'}}>
              <div
                style={{
                  ...styles.headerDot,
                  background: isRecording ? '#ef4444' : isTranscribing ? '#f59e0b' : isSpeaking ? '#f59e0b' : isThinking ? '#8b5cf6' : '#4ade80',
                }}
              />
              <AvatarIcon size={28} />
              <h2 style={{...styles.headerTitle, fontSize: 16}}>Mona Lau</h2>
              <button
                onClick={() => setWakeEnabled((w) => !w)}
                style={{
                  ...styles.headerIconButton,
                  marginLeft: 'auto',
                  ...(wakeEnabled ? styles.headerIconButtonActive : {}),
                }}
                aria-label={wakeEnabled ? 'Disable wake word' : 'Enable wake word ("hey mona")'}
                aria-pressed={wakeEnabled}
                title={wakeEnabled ? 'Wake word ON — say "hey mona"' : 'Enable wake word ("hey mona")'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 4v2" />
                  <path d="M12 18v2" />
                  <path d="M4 12h2" />
                  <path d="M18 12h2" />
                  <path d="M6.3 6.3l1.4 1.4" />
                  <path d="M16.3 16.3l1.4 1.4" />
                  <path d="M6.3 17.7l1.4-1.4" />
                  <path d="M16.3 7.7l1.4-1.4" />
                </svg>
              </button>
              <button onClick={() => { setMobileSheetOpen(false); setIsChatVisible(false); }} style={{...styles.headerIconButton, marginLeft: 8}} title="Close chat">✕</button>
            </div>

            <div style={{...styles.chatMessages, padding: '10px', paddingBottom: 12, overflowY: 'auto', flex: 1}}>
              {messages.length === 0 && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}><AvatarIcon size={40} /></div>
                  <p style={styles.emptyText}>Say hello — type a message or hold the mic to talk.</p>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} style={{...styles.messageBubble, ...(msg.sender === 'user' ? styles.userMessage : styles.avatarMessage)}}>
                  <div style={{...styles.messageContent, ...(msg.sender === 'user' ? styles.userContent : styles.avatarContent)}}>
                    <p style={styles.messageText}>{msg.text}</p>
                    {msg.imageUrl && (
                      <a href={msg.imageUrl} target="_blank" rel="noreferrer">
                        <img src={msg.imageUrl} alt="generated" style={{marginTop: 8, maxWidth: '100%', borderRadius: 12, display: 'block'}} />
                      </a>
                    )}
                    <div style={styles.messageFooter}>
                      <span style={styles.timestamp}>{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                    </div>
                  </div>
                </div>
              ))}

              <div ref={chatEndRef} />
            </div>

            <div style={{padding: 10, borderTop: '1px solid rgba(255,255,255,0.04)'}}>
              <div style={{display: 'flex', gap: 8, alignItems: 'flex-end'}}>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isThinking ? 'Waiting...' : 'Type a message...'}
                  style={{flex: 1, resize: 'none', minHeight: 36, maxHeight: 120, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', color: '#fff', border: 'none'}}
                  rows={1}
                  disabled={isThinking || isSpeaking}
                />
                <button onClick={handleSend} disabled={!inputText.trim() || isThinking || isSpeaking} style={{...styles.sendButton, ...(inputText.trim() ? styles.sendButtonActive : styles.sendButtonDisabled)}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
                <button onClick={toggleRecording} style={{...styles.micButton, ...(isRecording ? styles.micButtonRecording : styles.micButtonIdle)}}>
                  {isRecording ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.2; }
        }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        @keyframes recording-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
          50% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
        }
        @keyframes ptt-pulse {
          0%, 100% { box-shadow: 0 12px 50px rgba(14,165,233,0.45), 0 0 0 0 rgba(14,165,233,0.5); }
          50% { box-shadow: 0 12px 50px rgba(14,165,233,0.45), 0 0 0 24px rgba(14,165,233,0); }
        }
      `}</style>
      {panelMode === 'ptt' && (
        <div style={styles.fullscreenPtt} role="dialog" aria-label="Push to talk">
          <button
            onClick={() => setPanelMode('chat')}
            style={styles.fullscreenPttClose}
            aria-label="Close push to talk"
          >
            ✕
          </button>
          <div style={styles.fullscreenPttInner}>
            <div style={styles.pttInstructionsLarge}>
              {isRecording ? '🎙️ Listening...' : isTranscribing ? '⏳ Transcribing...' : 'Hold to talk'}
            </div>
            <button
              onMouseDown={() => { if (!isRecording) toggleRecording(); }}
              onMouseUp={() => { if (isRecording) toggleRecording(); }}
              onMouseLeave={() => { if (isRecording) toggleRecording(); }}
              onTouchStart={(e) => { e.preventDefault(); if (!isRecording) toggleRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); if (isRecording) toggleRecording(); }}
              style={{
                ...styles.fullscreenPttButton,
                animation: isRecording ? 'ptt-pulse 1.2s ease-in-out infinite' : undefined,
                background: isRecording ? '#ef4444' : isTranscribing ? '#f59e0b' : '#0ea5e9',
              }}
            >
              {isRecording ? (
                <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const buildStyles = (isMobile: boolean): Record<string, React.CSSProperties> => {
  if (!isMobile) return baseStyles;
  const merged: Record<string, React.CSSProperties> = {...baseStyles};
  for (const key of Object.keys(mobileOverrides)) {
    merged[key] = {...baseStyles[key], ...mobileOverrides[key]};
  }
  return merged;
};

const mobileOverrides: Record<string, React.CSSProperties> = {
  container: {
    flexDirection: 'column',
    paddingTop: 'env(safe-area-inset-top)',
  },
  avatarPanel: {
    flex: '0 0 30dvh',
    minHeight: '30dvh',
    maxHeight: '30dvh',
  },
  avatarPanelFull: {
    flex: '1 1 auto',
    minHeight: '100%',
    maxHeight: '100%',
  },
  chatPanel: {
    flex: '1 1 auto',
    maxWidth: '100%',
    minWidth: 0,
    borderLeft: 'none',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  chatHeader: {
    padding: '12px 16px',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
  },
  headerSubtitle: {
    fontSize: 11,
  },
  chatMessages: {
    padding: '12px 10px',
    paddingBottom: 120,
  },
  messageContent: {
    maxWidth: '88%',
    padding: '8px 12px',
  },
  inputArea: {
    paddingTop: 10,
    paddingLeft: 10,
    paddingRight: 10,
    paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
  },
  inputWrapper: {
    padding: '6px 6px 6px 14px',
    gap: 8,
  },
  textarea: {
    fontSize: 16, // 16px prevents iOS Safari focus-zoom
  },
  sendButton: {
    width: 42,
    height: 42,
  },
  micButton: {
    width: 42,
    height: 42,
  },
  pttButton: {
    width: 120,
    height: 120,
  },
  fullscreenPttButton: {
    width: 220,
    height: 220,
  },
  fullscreenPttClose: {
    width: 40,
    height: 40,
  },
  subtitleBar: {
    bottom: 12,
    left: 12,
    right: 12,
  },
  subtitleInner: {
    padding: '10px 14px',
    borderRadius: 12,
  },
  subtitleText: {
    fontSize: 14,
    lineHeight: 1.45,
  },
  thinkingOverlay: {
    top: 12,
  },
  speakingOverlay: {
    top: 12,
  },
  recordingOverlay: {
    top: 12,
  },
  emptyText: {
    fontSize: 13,
  },
  emptyIcon: {
    fontSize: 40,
  },
};

const baseStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },

  // === Avatar Panel ===
  avatarPanel: {
    flex: '1 1 60%',
    position: 'relative',
  },
  avatarPanelFull: {
    flex: '1 1 100%',
    position: 'relative',
  },
  avatarScene: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  mobileAvatarIcon: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 'env(safe-area-inset-top)'
  },
  mobileAvatarFloating: {
    position: 'fixed',
    top: 'calc(8px + env(safe-area-inset-top))',
    left: '12px',
    zIndex: 20000,
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 9999,
    padding: 6,
    backdropFilter: 'blur(6px)'
  },
  showChatButton: {
    position: 'absolute',
    top: 'calc(16px + env(safe-area-inset-top))',
    right: 'calc(16px + env(safe-area-inset-right))',
    width: 48,
    height: 48,
    borderRadius: 24,
    background: '#537fe7',
    border: '2px solid rgba(255,255,255,0.2)',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    boxShadow: '0 6px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(83,127,231,0.5)',
    padding: 0,
    animation: 'fadeInUp 0.25s ease-out',
  },
  headerIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    border: 'none',
    background: 'rgba(255,255,255,0.08)',
    color: '#aaa',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    flexShrink: 0,
    transition: 'background 0.2s, color 0.2s',
  },
  headerIconButtonActive: {
    background: 'rgba(239, 68, 68, 0.25)',
    color: '#fca5a5',
  },
  thinkingOverlay: {
    position: 'absolute',
    top: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    animation: 'fadeInUp 0.3s ease-out',
  },
  thinkingBubble: {
    background: 'rgba(139, 92, 246, 0.2)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: 20,
    padding: '8px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backdropFilter: 'blur(10px)',
  },
  thinkingDots: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8b5cf6',
    letterSpacing: 2,
  },
  dot: {
    animation: 'bounce 1s ease-in-out infinite',
    display: 'inline-block',
  },
  thinkingText: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: 500,
  },
  speakingOverlay: {
    position: 'absolute',
    top: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
  },
  speakingBadge: {
    display: 'flex',
    gap: 5,
    background: 'rgba(83, 127, 231, 0.2)',
    border: '1px solid rgba(83, 127, 231, 0.3)',
    borderRadius: 20,
    padding: '8px 18px',
    backdropFilter: 'blur(10px)',
  },
  speakingDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#537fe7',
    animation: 'pulse 0.6s ease-in-out infinite',
  },
  subtitleBar: {
    position: 'absolute',
    bottom: 25,
    left: 25,
    right: 25,
    zIndex: 10,
    animation: 'fadeInUp 0.3s ease-out',
  },
  subtitleInner: {
    background: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 14,
    padding: '12px 20px',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  subtitleText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: "'Segoe UI', Arial, sans-serif",
    fontWeight: 500,
    lineHeight: 1.5,
    margin: 0,
    textAlign: 'center',
  },
  cursor: {
    color: '#537fe7',
    animation: 'blink 0.8s step-end infinite',
  },

  // === Chat Panel ===
  chatPanel: {
    flex: '1 1 40%',
    display: 'flex',
    flexDirection: 'column',
    background: '#12121f',
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    maxWidth: 500,
    minWidth: 340,
  },
  chatHeader: {
    padding: '18px 22px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    transition: 'background 0.3s',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#f0f0f0',
    margin: 0,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    width: '100%',
    marginTop: 2,
  },
  chatMessages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 14px',
    paddingBottom: 120,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    opacity: 0.5,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 1.6,
    color: '#888',
  },
  messageBubble: {
    display: 'flex',
    animation: 'fadeInUp 0.25s ease-out',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  avatarMessage: {
    justifyContent: 'flex-start',
  },
  messageContent: {
    maxWidth: '82%',
    borderRadius: 16,
    padding: '10px 16px',
  },
  userContent: {
    background: '#537fe7',
    borderBottomRightRadius: 4,
  },
  avatarContent: {
    background: '#1e1e32',
    border: '1px solid rgba(255,255,255,0.06)',
    borderBottomLeftRadius: 4,
  },
  avatarMsgLabel: {
    fontSize: 11,
    color: '#8899bb',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  userMsgLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 600,
    display: 'block',
    marginBottom: 4,
  },
  messageText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: '#e8e8e8',
  },
  messageFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  replayButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    border: 'none',
    background: 'rgba(255,255,255,0.1)',
    color: '#8899bb',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    padding: 0,
    flexShrink: 0,
  },
  replayButtonPlaying: {
    background: 'rgba(83,127,231,0.3)',
    color: '#537fe7',
  },
  timestamp: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
  },
  typingIndicator: {
    display: 'flex',
    gap: 4,
    padding: '4px 0',
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#666',
    animation: 'pulse 0.8s ease-in-out infinite',
  },
  inputArea: {
    padding: '14px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  inputWrapper: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-end',
    background: '#1a1a2e',
    borderRadius: 16,
    padding: '8px 8px 8px 16px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  textarea: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#e0e0e0',
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'none',
    lineHeight: 1.5,
    padding: '6px 0',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  sendButtonActive: {
    background: '#537fe7',
    color: '#fff',
  },
  sendButtonDisabled: {
    background: '#2a2a3a',
    color: '#555',
    cursor: 'default',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  micButtonIdle: {
    background: '#2a2a3a',
    color: '#aaa',
  },
  micButtonRecording: {
    background: '#ef4444',
    color: '#fff',
    animation: 'recording-pulse 1.2s ease-in-out infinite',
  },
  micButtonDisabled: {
    background: '#2a2a3a',
    color: '#444',
    cursor: 'default',
  },
  recordingOverlay: {
    position: 'absolute',
    top: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    animation: 'fadeInUp 0.3s ease-out',
  },
  recordingBubble: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 20,
    padding: '8px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    backdropFilter: 'blur(10px)',
  },
  recordingPulse: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#ef4444',
    animation: 'pulse 0.8s ease-in-out infinite',
  },
  recordingText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: 500,
  },

  // Push-to-talk overlay styles
  pttOverlay: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 20,
    padding: 20,
  },
  pttInstructions: {
    color: '#bfc7d9',
    fontSize: 15,
  },
  pttButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    border: 'none',
    background: '#0ea5e9',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 30px rgba(14,165,233,0.35)',
    cursor: 'pointer',
  },

  // Full-screen push-to-talk (car mode)
  fullscreenPtt: {
    position: 'fixed',
    inset: 0,
    zIndex: 99999,
    background: 'rgba(0,8,20,0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    padding: 20,
  },
  fullscreenPttInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 24,
  },
  fullscreenPttClose: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 60,
    height: 60,
    borderRadius: 12,
    border: 'none',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 24,
    cursor: 'pointer',
  },
  pttInstructionsLarge: {
    color: '#d1d8e6',
    fontSize: 20,
    fontWeight: 600,
  },
  fullscreenPttButton: {
    width: 320,
    height: 320,
    borderRadius: 160,
    border: 'none',
    background: '#0ea5e9',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 12px 50px rgba(14,165,233,0.45)',
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
};
