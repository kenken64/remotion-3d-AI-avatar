export type MouthShape = 'closed' | 'A' | 'E' | 'I' | 'O' | 'U' | 'F' | 'L' | 'M';

// Map each English character to a viseme (mouth shape)
const charToViseme: Record<string, MouthShape> = {
  a: 'A',
  b: 'M',
  c: 'E',
  d: 'E',
  e: 'E',
  f: 'F',
  g: 'E',
  h: 'A',
  i: 'I',
  j: 'I',
  k: 'E',
  l: 'L',
  m: 'M',
  n: 'L',
  o: 'O',
  p: 'M',
  q: 'O',
  r: 'E',
  s: 'E',
  t: 'E',
  u: 'U',
  v: 'F',
  w: 'U',
  x: 'E',
  y: 'I',
  z: 'E',
};

// Chinese characters are CJK Unified Ideographs: U+4E00–U+9FFF
function isChinese(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

// Map Chinese characters to visemes based on char code for varied mouth movement.
// Each Chinese syllable typically has an open vowel sound, so we rotate through
// speaking shapes to create natural-looking articulation.
const chineseVisemes: MouthShape[] = ['A', 'O', 'E', 'I', 'U', 'A', 'L', 'E', 'O', 'M'];

function getChineseViseme(char: string): MouthShape {
  const code = char.charCodeAt(0);
  return chineseVisemes[code % chineseVisemes.length];
}

// Tamil block: U+0B80–U+0BFF
function isTamil(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x0b80 && code <= 0x0bff;
}

// Map each Tamil codepoint to a viseme. Vowels and matras (vowel signs) drive
// the mouth shape; consonants fall back to a shape based on place of
// articulation. The virama (், U+0BCD) suppresses the inherent vowel so we
// render it as a brief closed transition.
const tamilToViseme: Record<number, MouthShape> = {
  // Vowels
  0x0b85: 'A', // அ
  0x0b86: 'A', // ஆ
  0x0b87: 'I', // இ
  0x0b88: 'I', // ஈ
  0x0b89: 'U', // உ
  0x0b8a: 'U', // ஊ
  0x0b8e: 'E', // எ
  0x0b8f: 'E', // ஏ
  0x0b90: 'I', // ஐ
  0x0b92: 'O', // ஒ
  0x0b93: 'O', // ஓ
  0x0b94: 'U', // ஔ
  // Vowel signs (matras)
  0x0bbe: 'A', // ா
  0x0bbf: 'I', // ி
  0x0bc0: 'I', // ீ
  0x0bc1: 'U', // ு
  0x0bc2: 'U', // ூ
  0x0bc6: 'E', // ெ
  0x0bc7: 'E', // ே
  0x0bc8: 'I', // ை
  0x0bca: 'O', // ொ
  0x0bcb: 'O', // ோ
  0x0bcc: 'U', // ௌ
  0x0bcd: 'closed', // ் virama
  // Consonants
  0x0b95: 'A', // க
  0x0b99: 'A', // ங
  0x0b9a: 'E', // ச
  0x0b9c: 'E', // ஜ
  0x0b9e: 'I', // ஞ
  0x0b9f: 'E', // ட
  0x0ba3: 'L', // ண
  0x0ba4: 'E', // த
  0x0ba8: 'L', // ந
  0x0ba9: 'L', // ன
  0x0baa: 'M', // ப
  0x0bae: 'M', // ம
  0x0baf: 'I', // ய
  0x0bb0: 'E', // ர
  0x0bb1: 'E', // ற
  0x0bb2: 'L', // ல
  0x0bb3: 'L', // ள
  0x0bb4: 'L', // ழ
  0x0bb5: 'F', // வ
  0x0bb6: 'E', // ஶ
  0x0bb7: 'E', // ஷ
  0x0bb8: 'E', // ஸ
  0x0bb9: 'A', // ஹ
};

function getTamilViseme(char: string): MouthShape {
  return tamilToViseme[char.charCodeAt(0)] ?? 'A';
}

interface VisemeFrame {
  shape: MouthShape;
  startFrame: number;
  endFrame: number;
}

/**
 * Convert text into a sequence of viseme frames.
 * Each character gets a fixed number of frames.
 * Spaces and punctuation get 'closed' mouth.
 */
export function textToVisemes(
  text: string,
  fps: number,
  totalFrames: number,
): VisemeFrame[] {
  const chars = text.toLowerCase().split('');
  const framesPerChar = Math.max(2, Math.floor(totalFrames / Math.max(chars.length, 1)));
  const visemes: VisemeFrame[] = [];

  let currentFrame = 0;

  for (const char of chars) {
    if (currentFrame >= totalFrames) break;

    const isLetter = /[a-z]/.test(char);
    const isCJK = isChinese(char);
    const isTamilChar = isTamil(char);
    const shape: MouthShape = isLetter
      ? (charToViseme[char] || 'A')
      : isCJK
        ? getChineseViseme(char)
        : isTamilChar
          ? getTamilViseme(char)
          : 'closed';

    // Add a brief transition to closed between words and punctuation
    // (English + Chinese + Tamil danda). Tamil itself uses ASCII punctuation.
    if (char === ' ' || /[.,!?;:，。！？；：、।॥]/.test(char)) {
      visemes.push({
        shape: 'closed',
        startFrame: currentFrame,
        endFrame: Math.min(currentFrame + Math.ceil(framesPerChar * 1.2), totalFrames),
      });
      currentFrame += Math.ceil(framesPerChar * 1.2);
    } else {
      visemes.push({
        shape,
        startFrame: currentFrame,
        endFrame: Math.min(currentFrame + framesPerChar, totalFrames),
      });
      currentFrame += framesPerChar;
    }
  }

  // Fill remaining frames with closed mouth
  if (currentFrame < totalFrames) {
    visemes.push({
      shape: 'closed',
      startFrame: currentFrame,
      endFrame: totalFrames,
    });
  }

  return visemes;
}

/**
 * Get the mouth shape for a specific frame.
 */
export function getMouthShapeAtFrame(
  visemes: VisemeFrame[],
  frame: number,
): MouthShape {
  for (const v of visemes) {
    if (frame >= v.startFrame && frame < v.endFrame) {
      return v.shape;
    }
  }
  return 'closed';
}

/**
 * Get the current character index being spoken at a given frame.
 */
export function getCharIndexAtFrame(
  text: string,
  totalFrames: number,
  frame: number,
): number {
  const chars = text.split('');
  const framesPerChar = Math.max(2, Math.floor(totalFrames / Math.max(chars.length, 1)));
  return Math.min(Math.floor(frame / framesPerChar), chars.length);
}
