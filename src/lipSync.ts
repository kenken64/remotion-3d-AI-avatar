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
    const shape: MouthShape = isLetter
      ? (charToViseme[char] || 'A')
      : isCJK
        ? getChineseViseme(char)
        : 'closed';

    // Add a brief transition to closed between words and punctuation (English + Chinese)
    if (char === ' ' || /[.,!?;:，。！？；：、]/.test(char)) {
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
