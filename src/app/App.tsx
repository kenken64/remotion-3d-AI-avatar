import React, {useState, useRef, useEffect, useCallback} from 'react';
import {Avatar3D} from '../Avatar3D';
import {useAudioLipSync} from './useAudioLipSync';
import {sendChatMessage, fetchSpeechAudio, ChatMsg} from './api';
import type {MouthShape} from '../lipSync';

interface ChatMessage {
  id: number;
  text: string;
  sender: 'user' | 'avatar';
  timestamp: Date;
}

export const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [breatheY, setBreatheY] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);
  const conversationRef = useRef<ChatMsg[]>([]);
  const breatheRef = useRef(0);

  const {mouthShape, isSpeaking, spokenText, currentSpeech, speak} =
    useAudioLipSync();

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

  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isThinking || isSpeaking) return;

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      {
        id: ++messageIdRef.current,
        text: trimmed,
        sender: 'user',
        timestamp: new Date(),
      },
    ]);
    setInputText('');

    // Add to conversation history
    conversationRef.current.push({role: 'user', content: trimmed});

    setIsThinking(true);

    try {
      // Get AI response
      const reply = await sendChatMessage(conversationRef.current);
      conversationRef.current.push({role: 'assistant', content: reply});

      // Get TTS audio
      const audioBlob = await fetchSpeechAudio(reply);

      setIsThinking(false);

      // Play audio + lip sync
      await speak(reply, audioBlob);

      // Add avatar message after speaking
      setMessages((prev) => [
        ...prev,
        {
          id: ++messageIdRef.current,
          text: reply,
          sender: 'avatar',
          timestamp: new Date(),
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
  }, [inputText, isThinking, isSpeaking, speak]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeMouth = isSpeaking ? mouthShape : idleMouth;

  return (
    <div style={styles.container}>
      {/* Left: 3D Avatar */}
      <div style={styles.avatarPanel}>
        <div style={styles.avatarScene}>
          <Avatar3D mouthShape={activeMouth} breatheY={breatheY} />

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
      <div style={styles.chatPanel}>
        <div style={styles.chatHeader}>
          <div
            style={{
              ...styles.headerDot,
              background: isSpeaking ? '#f59e0b' : isThinking ? '#8b5cf6' : '#4ade80',
            }}
          />
          <h2 style={styles.headerTitle}>AI Avatar</h2>
          <span style={styles.headerSubtitle}>
            {isSpeaking
              ? 'Speaking...'
              : isThinking
                ? 'Thinking...'
                : 'Chat with the AI avatar'}
          </span>
        </div>

        <div style={styles.chatMessages}>
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🤖</div>
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
                  <span style={styles.avatarMsgLabel}>🤖 AI Avatar</span>
                )}
                {msg.sender === 'user' && (
                  <span style={styles.userMsgLabel}>You</span>
                )}
                <p style={styles.messageText}>{msg.text}</p>
                <span style={styles.timestamp}>
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
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
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
  },

  // === Avatar Panel ===
  avatarPanel: {
    flex: '1 1 60%',
    position: 'relative',
  },
  avatarScene: {
    width: '100%',
    height: '100%',
    position: 'relative',
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
    display: 'block',
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
  timestamp: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
    display: 'block',
    textAlign: 'right',
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
};
