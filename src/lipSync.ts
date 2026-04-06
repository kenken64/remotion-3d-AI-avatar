export type MouthShape = 'closed' | 'A' | 'E' | 'I' | 'O' | 'U' | 'F' | 'L' | 'M';

// Map each character to a viseme (mouth shape)
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
    const shape: MouthShape = isLetter ? (charToViseme[char] || 'A') : 'closed';

    // Add a brief transition to closed between words
    if (char === ' ' || /[.,!?;:]/.test(char)) {
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
