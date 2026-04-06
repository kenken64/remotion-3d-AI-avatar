import React from 'react';

type MouthShape = 'closed' | 'A' | 'E' | 'I' | 'O' | 'U' | 'F' | 'L' | 'M';

interface CartoonAvatarProps {
  mouthShape: MouthShape;
}

const getMouthPath = (shape: MouthShape): React.ReactNode => {
  switch (shape) {
    case 'closed':
      return (
        <path
          d="M 230 420 Q 270 425 310 420"
          fill="none"
          stroke="#c1443e"
          strokeWidth="3"
          strokeLinecap="round"
        />
      );
    case 'A':
      return (
        <ellipse cx="270" cy="420" rx="28" ry="18" fill="#8b0000" stroke="#c1443e" strokeWidth="2">
          <animate attributeName="ry" values="0;18" dur="0.08s" fill="freeze" />
        </ellipse>
      );
    case 'E':
      return (
        <ellipse cx="270" cy="418" rx="22" ry="8" fill="#8b0000" stroke="#c1443e" strokeWidth="2">
          <animate attributeName="rx" values="0;22" dur="0.06s" fill="freeze" />
        </ellipse>
      );
    case 'I':
      return (
        <ellipse cx="270" cy="418" rx="12" ry="10" fill="#8b0000" stroke="#c1443e" strokeWidth="2">
          <animate attributeName="ry" values="0;10" dur="0.06s" fill="freeze" />
        </ellipse>
      );
    case 'O':
      return (
        <ellipse cx="270" cy="420" rx="16" ry="20" fill="#8b0000" stroke="#c1443e" strokeWidth="2">
          <animate attributeName="ry" values="0;20" dur="0.08s" fill="freeze" />
        </ellipse>
      );
    case 'U':
      return (
        <ellipse cx="270" cy="420" rx="12" ry="16" fill="#8b0000" stroke="#c1443e" strokeWidth="2">
          <animate attributeName="ry" values="0;16" dur="0.07s" fill="freeze" />
        </ellipse>
      );
    case 'F':
      return (
        <>
          <path d="M 248 415 Q 270 420 292 415" fill="none" stroke="#c1443e" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 250 414 Q 270 410 290 414" fill="none" stroke="#e8c4a0" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'L':
      return (
        <ellipse cx="270" cy="418" rx="18" ry="10" fill="#8b0000" stroke="#c1443e" strokeWidth="2">
          <animate attributeName="ry" values="0;10" dur="0.06s" fill="freeze" />
        </ellipse>
      );
    case 'M':
      return (
        <path
          d="M 245 420 Q 270 428 295 420"
          fill="none"
          stroke="#c1443e"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      );
    default:
      return (
        <path
          d="M 230 420 Q 270 425 310 420"
          fill="none"
          stroke="#c1443e"
          strokeWidth="3"
          strokeLinecap="round"
        />
      );
  }
};

export const CartoonAvatar: React.FC<CartoonAvatarProps> = ({mouthShape}) => {
  return (
    <svg
      viewBox="0 0 540 750"
      xmlns="http://www.w3.org/2000/svg"
      style={{width: '100%', height: '100%'}}
    >
      <defs>
        {/* Skin gradient */}
        <radialGradient id="skinGrad" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#f5d5b8" />
          <stop offset="100%" stopColor="#e8b896" />
        </radialGradient>
        {/* Hair gradient */}
        <linearGradient id="hairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="50%" stopColor="#2d2d44" />
          <stop offset="100%" stopColor="#1a1a2e" />
        </linearGradient>
        {/* Suit gradient */}
        <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2a2a3a" />
          <stop offset="100%" stopColor="#1a1a28" />
        </linearGradient>
        {/* Shadow filter */}
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
        </filter>
        {/* Glasses lens gradient */}
        <linearGradient id="lensGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(200,220,255,0.15)" />
          <stop offset="100%" stopColor="rgba(180,200,240,0.08)" />
        </linearGradient>
      </defs>

      {/* ===== BODY / SUIT ===== */}
      {/* Shoulders and torso */}
      <path
        d="M 60 750 L 60 580 Q 60 500 150 470 L 270 450 L 390 470 Q 480 500 480 580 L 480 750 Z"
        fill="url(#suitGrad)"
        stroke="#15152a"
        strokeWidth="1"
      />

      {/* Suit lapels - left */}
      <path
        d="M 175 470 L 220 550 L 265 470"
        fill="none"
        stroke="#3a3a50"
        strokeWidth="2.5"
      />
      {/* Suit lapels - right */}
      <path
        d="M 365 470 L 320 550 L 275 470"
        fill="none"
        stroke="#3a3a50"
        strokeWidth="2.5"
      />

      {/* White shirt / collar area */}
      <path
        d="M 230 465 L 270 535 L 310 465"
        fill="#f0f0f5"
        stroke="#ddd"
        strokeWidth="1"
      />

      {/* Tie */}
      <path
        d="M 262 475 L 270 540 L 278 475"
        fill="#1a1a2e"
        stroke="#111"
        strokeWidth="0.5"
      />
      {/* Tie knot */}
      <ellipse cx="270" cy="472" rx="10" ry="6" fill="#1a1a2e" stroke="#111" strokeWidth="0.5" />
      {/* Tie body continues */}
      <path
        d="M 263 540 L 270 680 L 277 540"
        fill="#1a1a2e"
        stroke="#111"
        strokeWidth="0.5"
      />

      {/* Crossed arms - left arm over */}
      <path
        d="M 100 580 Q 140 600 200 620 Q 260 640 340 610 Q 380 595 400 570"
        fill="url(#suitGrad)"
        stroke="#15152a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Right arm under */}
      <path
        d="M 440 580 Q 400 600 340 620 Q 280 640 200 610 Q 160 595 140 570"
        fill="url(#suitGrad)"
        stroke="#15152a"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Left hand (on right side, arms crossed) */}
      <path
        d="M 380 585 Q 395 580 400 570 Q 405 562 398 558"
        fill="#e8b896"
        stroke="#d4a07a"
        strokeWidth="1"
      />
      {/* Right hand (on left side) */}
      <path
        d="M 160 585 Q 145 580 140 570 Q 135 562 142 558"
        fill="#e8b896"
        stroke="#d4a07a"
        strokeWidth="1"
      />

      {/* ===== NECK ===== */}
      <path
        d="M 245 445 L 245 465 Q 270 475 295 465 L 295 445"
        fill="url(#skinGrad)"
        stroke="none"
      />

      {/* ===== HEAD ===== */}
      {/* Face shape - slightly angular jaw */}
      <path
        d="M 180 320
           Q 180 220 270 200
           Q 360 220 360 320
           Q 360 380 330 420
           Q 310 450 270 455
           Q 230 450 210 420
           Q 180 380 180 320"
        fill="url(#skinGrad)"
        filter="url(#shadow)"
      />

      {/* Ears */}
      <ellipse cx="178" cy="340" rx="14" ry="22" fill="#e8b896" stroke="#d4a07a" strokeWidth="1" />
      <ellipse cx="362" cy="340" rx="14" ry="22" fill="#e8b896" stroke="#d4a07a" strokeWidth="1" />
      <ellipse cx="178" cy="340" rx="7" ry="12" fill="#d4a07a" opacity="0.3" />
      <ellipse cx="362" cy="340" rx="7" ry="12" fill="#d4a07a" opacity="0.3" />

      {/* ===== HAIR ===== */}
      {/* Main hair volume - swept to the right */}
      <path
        d="M 175 290
           Q 170 200 220 170
           Q 260 155 310 160
           Q 370 170 380 220
           Q 385 250 365 280
           Q 360 270 350 265
           Q 340 230 310 210
           Q 280 195 250 200
           Q 220 210 210 240
           Q 200 260 195 280
           Q 185 300 175 290"
        fill="url(#hairGrad)"
      />
      {/* Hair top sweep */}
      <path
        d="M 200 230
           Q 210 170 270 155
           Q 340 150 370 190
           Q 385 215 375 250
           Q 365 225 340 205
           Q 310 185 270 185
           Q 235 188 215 210
           Q 200 230 200 230"
        fill="#222238"
      />
      {/* Side hair - left */}
      <path
        d="M 178 290 Q 172 260 180 240 Q 185 260 190 280 Q 185 290 178 290"
        fill="url(#hairGrad)"
      />
      {/* Side hair - right */}
      <path
        d="M 362 280 Q 368 260 365 240 Q 358 260 355 275 Q 358 282 362 280"
        fill="url(#hairGrad)"
      />
      {/* Hair highlight */}
      <path
        d="M 250 170 Q 280 160 320 168"
        fill="none"
        stroke="#3d3d55"
        strokeWidth="2"
        opacity="0.4"
      />

      {/* ===== EYEBROWS ===== */}
      {/* Left eyebrow - slightly furrowed */}
      <path
        d="M 210 295 Q 230 285 255 290"
        fill="none"
        stroke="#1a1a2e"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Right eyebrow */}
      <path
        d="M 285 290 Q 310 285 330 295"
        fill="none"
        stroke="#1a1a2e"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* ===== GLASSES ===== */}
      {/* Left lens */}
      <rect
        x="205" y="305" width="55" height="40" rx="8" ry="8"
        fill="url(#lensGrad)"
        stroke="#8a8a9a"
        strokeWidth="2"
      />
      {/* Right lens */}
      <rect
        x="280" y="305" width="55" height="40" rx="8" ry="8"
        fill="url(#lensGrad)"
        stroke="#8a8a9a"
        strokeWidth="2"
      />
      {/* Bridge */}
      <path
        d="M 260 322 Q 270 318 280 322"
        fill="none"
        stroke="#8a8a9a"
        strokeWidth="2"
      />
      {/* Left temple */}
      <path
        d="M 205 318 L 182 315"
        fill="none"
        stroke="#8a8a9a"
        strokeWidth="2"
      />
      {/* Right temple */}
      <path
        d="M 335 318 L 358 315"
        fill="none"
        stroke="#8a8a9a"
        strokeWidth="2"
      />

      {/* ===== EYES ===== */}
      {/* Left eye white */}
      <ellipse cx="232" cy="325" rx="16" ry="11" fill="white" />
      {/* Left iris */}
      <ellipse cx="234" cy="326" rx="8" ry="9" fill="#2c1810" />
      {/* Left pupil */}
      <ellipse cx="235" cy="326" rx="4" ry="4.5" fill="#0a0a0a" />
      {/* Left eye highlight */}
      <ellipse cx="237" cy="322" rx="2.5" ry="2" fill="white" opacity="0.9" />

      {/* Right eye white */}
      <ellipse cx="308" cy="325" rx="16" ry="11" fill="white" />
      {/* Right iris */}
      <ellipse cx="306" cy="326" rx="8" ry="9" fill="#2c1810" />
      {/* Right pupil */}
      <ellipse cx="305" cy="326" rx="4" ry="4.5" fill="#0a0a0a" />
      {/* Right eye highlight */}
      <ellipse cx="307" cy="322" rx="2.5" ry="2" fill="white" opacity="0.9" />

      {/* ===== NOSE ===== */}
      <path
        d="M 268 350 Q 265 375 258 388 Q 265 392 270 393 Q 275 392 282 388 Q 275 375 272 350"
        fill="none"
        stroke="#d4a07a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Nostrils hint */}
      <circle cx="261" cy="389" r="2.5" fill="#d4a07a" opacity="0.5" />
      <circle cx="279" cy="389" r="2.5" fill="#d4a07a" opacity="0.5" />

      {/* ===== MOUTH (animated) ===== */}
      <g id="mouth">
        {getMouthPath(mouthShape)}
      </g>

      {/* ===== SUBTLE DETAILS ===== */}
      {/* Jaw shadow */}
      <path
        d="M 210 420 Q 240 445 270 450 Q 300 445 330 420"
        fill="none"
        stroke="#d4a07a"
        strokeWidth="1"
        opacity="0.3"
      />
    </svg>
  );
};
