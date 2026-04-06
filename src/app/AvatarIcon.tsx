import React from 'react';

interface AvatarIconProps {
  size?: number;
}

export const AvatarIcon: React.FC<AvatarIconProps> = ({size = 28}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      style={{flexShrink: 0, borderRadius: '50%', background: '#0a0f1e'}}
    >
      {/* Background circle */}
      <circle cx="32" cy="32" r="32" fill="#0a0f1e" />

      {/* Neck */}
      <rect x="27" y="44" width="10" height="6" rx="2" fill="#f0c8a0" />

      {/* Suit / shoulders */}
      <path
        d="M 12 58 Q 12 48 22 45 L 32 43 L 42 45 Q 52 48 52 58 L 52 64 L 12 64 Z"
        fill="#1a1a28"
      />
      {/* Shirt */}
      <path d="M 28 45 L 32 52 L 36 45" fill="#f0f0f5" />
      {/* Bow tie left */}
      <ellipse cx="29" cy="46" rx="3" ry="1.5" fill="#0a0a18" />
      {/* Bow tie right */}
      <ellipse cx="35" cy="46" rx="3" ry="1.5" fill="#0a0a18" />
      {/* Bow tie center */}
      <circle cx="32" cy="46" r="1.2" fill="#0a0a18" />

      {/* Head */}
      <ellipse cx="32" cy="30" rx="16" ry="18" fill="#f0c8a0" />

      {/* Hair - base dark pink */}
      <ellipse cx="32" cy="18" rx="17" ry="10" fill="#c0306b" />
      {/* Hair - main pink */}
      <ellipse cx="34" cy="16" rx="14" ry="9" fill="#e84393" />
      {/* Hair - highlight swept */}
      <ellipse cx="37" cy="14" rx="8" ry="6" fill="#ff8cc8" />
      {/* Hair - front fringe */}
      <ellipse cx="36" cy="21" rx="10" ry="4" fill="#e84393" />
      {/* Hair - spike top */}
      <ellipse cx="38" cy="11" rx="5" ry="5" fill="#ff8cc8" />

      {/* Eyes - white */}
      <ellipse cx="26" cy="30" rx="4" ry="3" fill="white" />
      <ellipse cx="38" cy="30" rx="4" ry="3" fill="white" />
      {/* Eyes - iris */}
      <circle cx="26.5" cy="30.5" r="2" fill="#2c1810" />
      <circle cx="38.5" cy="30.5" r="2" fill="#2c1810" />
      {/* Eyes - pupil */}
      <circle cx="27" cy="30.5" r="1" fill="#050505" />
      <circle cx="39" cy="30.5" r="1" fill="#050505" />
      {/* Eyes - highlight */}
      <circle cx="27.5" cy="29.5" r="0.7" fill="white" />
      <circle cx="39.5" cy="29.5" r="0.7" fill="white" />

      {/* Glasses */}
      <rect x="21" y="27" width="10" height="7" rx="2" fill="none" stroke="#888899" strokeWidth="1.2" />
      <rect x="33" y="27" width="10" height="7" rx="2" fill="none" stroke="#888899" strokeWidth="1.2" />
      <path d="M 31 30 Q 32 28.5 33 30" fill="none" stroke="#888899" strokeWidth="1" />
      <line x1="21" y1="30" x2="17" y2="29" stroke="#888899" strokeWidth="1" />
      <line x1="43" y1="30" x2="47" y2="29" stroke="#888899" strokeWidth="1" />

      {/* Eyebrows */}
      <path d="M 22 25.5 Q 26 23.5 30 25" stroke="#c0306b" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M 34 25 Q 38 23.5 42 25.5" stroke="#c0306b" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Nose */}
      <path d="M 31 33 Q 30 37 29 38 Q 32 39 35 38 Q 34 37 33 33" fill="none" stroke="#d4a07a" strokeWidth="0.8" />

      {/* Smile */}
      <path d="M 27 40 Q 32 43 37 40" fill="none" stroke="#c1665a" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
};
