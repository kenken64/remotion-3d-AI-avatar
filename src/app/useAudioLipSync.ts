import {useState, useRef, useCallback} from 'react';
import {
  MouthShape,
  textToVisemes,
  getMouthShapeAtFrame,
  getCharIndexAtFrame,
} from '../lipSync';

const FPS = 30;

interface AudioLipSyncState {
  mouthShape: MouthShape;
  isSpeaking: boolean;
  spokenText: string;
  currentSpeech: string;
}

export function useAudioLipSync() {
  const [state, setState] = useState<AudioLipSyncState>({
    mouthShape: 'closed',
    isSpeaking: false,
    spokenText: '',
    currentSpeech: '',
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const urlRef = useRef<string>('');

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = '';
    }
  }, []);

  const speak = useCallback(
    (text: string, audioBlob: Blob): Promise<void> => {
      return new Promise((resolve) => {
        cleanup();

        const url = URL.createObjectURL(audioBlob);
        urlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        setState({
          mouthShape: 'closed',
          isSpeaking: true,
          spokenText: '',
          currentSpeech: text,
        });

        audio.addEventListener('loadedmetadata', () => {
          const duration = audio.duration;
          const totalFrames = Math.ceil(duration * FPS);
          const visemes = textToVisemes(text, FPS, totalFrames);

          const tick = () => {
            if (!audioRef.current) return;
            const currentTime = audioRef.current.currentTime;
            const frame = Math.floor(currentTime * FPS);
            const shape = getMouthShapeAtFrame(visemes, frame);
            const charIdx = getCharIndexAtFrame(text, totalFrames, frame);

            setState({
              mouthShape: shape,
              isSpeaking: true,
              spokenText: text.slice(0, charIdx),
              currentSpeech: text,
            });

            if (!audioRef.current?.paused && !audioRef.current?.ended) {
              rafRef.current = requestAnimationFrame(tick);
            }
          };

          audio.play().then(() => {
            rafRef.current = requestAnimationFrame(tick);
          });
        });

        audio.addEventListener('ended', () => {
          cleanup();
          setState({
            mouthShape: 'closed',
            isSpeaking: false,
            spokenText: text,
            currentSpeech: '',
          });
          resolve();
        });

        audio.addEventListener('error', () => {
          cleanup();
          setState({
            mouthShape: 'closed',
            isSpeaking: false,
            spokenText: '',
            currentSpeech: '',
          });
          resolve();
        });
      });
    },
    [cleanup],
  );

  return {
    ...state,
    speak,
  };
}
