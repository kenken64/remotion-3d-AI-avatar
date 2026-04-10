import React, {useState, useRef, useEffect, useCallback, useMemo} from 'react';
import {Avatar3D} from '../Avatar3D';
import {useAudioLipSync} from './useAudioLipSync';
import {sendChatMessage, fetchSpeechAudio, transcribeAudio, ChatMsg} from './api';
import {AvatarIcon} from './AvatarIcon';
import type {MouthShape} from '../lipSync';

const MOBILE_BREAKPOINT = 768;

const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
      : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
};

interface ChatMessage {
  id: number;
  text: string;
  sender: 'user' | 'avatar';
  timestamp: Date;
  audioUrl?: string; // object URL for TTS audio replay
}

export const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [breatheY, setBreatheY] = useState(0);
  const [playingMsgId, setPlayingMsgId] = useState<number | null>(null);
  const [isChatVisible, setIsChatVisible] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);
  const conversationRef = useRef<ChatMsg[]>([]);
  const breatheRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const {mouthShape, isSpeaking, spokenText, currentSpeech, speak} =
    useAudioLipSync();

  const isMobile = useIsMobile();
  const styles = useMemo(() => buildStyles(isMobile), [isMobile]);

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
      const reply = await sendChatMessage(conversationRef.current);
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
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
        setIsRecording(false);
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
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  }, [isRecording, isThinking, isSpeaking, isTranscribing, sendMessage]);

  // Replay avatar audio
  const replayAudio = useCallback((msgId: number, audioUrl: string) => {
    if (playingMsgId === msgId) return; // already playing this one
    const audio = new Audio(audioUrl);
    setPlayingMsgId(msgId);
    audio.play();
    audio.onended = () => setPlayingMsgId(null);
    audio.onerror = () => setPlayingMsgId(null);
  }, [playingMsgId]);

  const activeMouth = isSpeaking ? mouthShape : idleMouth;

  return (
    <div style={styles.container}>
      {/* Left: 3D Avatar */}
      <div style={isChatVisible ? styles.avatarPanel : styles.avatarPanelFull}>
        <div style={styles.avatarScene}>
          <Avatar3D mouthShape={activeMouth} breatheY={breatheY} isSpeaking={isSpeaking} />

          {/* Show-chat floating button — visible when chat panel is hidden */}
          {!isChatVisible && (
            <button
              onClick={() => setIsChatVisible(true)}
              style={styles.showChatButton}
              aria-label="Show chat panel"
              title="Show chat"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
      {isChatVisible && (
      <div style={styles.chatPanel}>
        <div style={styles.chatHeader}>
          <div
            style={{
              ...styles.headerDot,
              background: isRecording ? '#ef4444' : isTranscribing ? '#f59e0b' : isSpeaking ? '#f59e0b' : isThinking ? '#8b5cf6' : '#4ade80',
            }}
          />
          <AvatarIcon size={32} />
          <h2 style={styles.headerTitle}>AI Avatar</h2>
          <button
            onClick={() => setIsChatVisible(false)}
            style={styles.closeChatButton}
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
                  <span style={styles.avatarMsgLabel}><AvatarIcon size={18} /> AI Avatar</span>
                )}
                {msg.sender === 'user' && (
                  <span style={styles.userMsgLabel}>You</span>
                )}
                <p style={styles.messageText}>{msg.text}</p>
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
                <span style={styles.avatarMsgLabel}>🤖 AI Avatar</span>
                <div style={styles.typingIndicator}>
                  <div style={styles.typingDot} />
                  <div style={{...styles.typingDot, animationDelay: '0.15s'}} />
                  <div style={{...styles.typingDot, animationDelay: '0.3s'}} />
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
      `}</style>
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
  },
  avatarPanel: {
    flex: '0 0 42dvh',
    minHeight: '42dvh',
    maxHeight: '42dvh',
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
  showChatButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    background: 'rgba(83, 127, 231, 0.85)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
    zIndex: 20,
    boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
    padding: 0,
    animation: 'fadeInUp 0.25s ease-out',
  },
  closeChatButton: {
    marginLeft: 'auto',
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
};
