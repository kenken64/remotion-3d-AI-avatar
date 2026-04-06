import React, {useMemo} from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import {CartoonAvatar} from './CartoonAvatar';
import {textToVisemes, getMouthShapeAtFrame, getCharIndexAtFrame} from './lipSync';

interface AvatarCompositionProps {
  text: string;
}

// Calculate how many frames a given text needs at ~10 chars/sec speaking rate
export function calculateDuration(text: string, fps: number): number {
  const charsPerSecond = 10;
  const seconds = Math.max(1, text.length / charsPerSecond);
  return Math.ceil(seconds * fps);
}

export const AvatarComposition: React.FC<AvatarCompositionProps> = ({text}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const visemes = useMemo(
    () => textToVisemes(text, fps, durationInFrames),
    [text, fps, durationInFrames],
  );

  const mouthShape = getMouthShapeAtFrame(visemes, frame);

  // Get how much text has been "spoken" so far
  const charIndex = getCharIndexAtFrame(text, durationInFrames, frame);
  const spokenText = text.slice(0, charIndex);

  // Subtle idle breathing animation
  const breathe = interpolate(Math.sin(frame * 0.08), [-1, 1], [-2, 2]);

  // Entry scale spring
  const entryScale = spring({
    frame,
    fps,
    config: {damping: 15, stiffness: 80},
  });

  // Text reveal opacity
  const textOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '100%',
          flex: 1,
          transform: `scale(${entryScale}) translateY(${breathe}px)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CartoonAvatar mouthShape={mouthShape} />
      </div>

      {/* Subtitle text */}
      {text.trim() && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            right: 20,
            opacity: textOpacity,
          }}
        >
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.65)',
              borderRadius: 12,
              padding: '12px 20px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <p
              style={{
                color: '#ffffff',
                fontSize: 16,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                fontWeight: 500,
                lineHeight: 1.5,
                margin: 0,
                textAlign: 'center',
                letterSpacing: 0.3,
              }}
            >
              {spokenText}
              {charIndex < text.length && (
                <span
                  style={{
                    opacity: frame % 20 < 10 ? 1 : 0.3,
                    color: '#537fe7',
                  }}
                >
                  |
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
