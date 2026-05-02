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

// Each clip in the queue plays back-to-back. `ownsUrl` is true for streaming
// segments (we created the object URL from a Blob and must revoke it on end);
// false for replay (the URL is a stored reference on a chat message and must
// outlive the playback).
interface QueueItem {
  text: string;
  url: string;
  ownsUrl: boolean;
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
  const mutedRef = useRef<boolean>(false);

  // Queue of pending clips. Items are appended by streaming `enqueue` calls
  // and consumed in order by `playNext`. `playingRef` guards against double-
  // starting the player, `streamDoneRef` tells the player whether the queue
  // is closed so it can resolve the finish promise once it drains.
  const queueRef = useRef<QueueItem[]>([]);
  const playingRef = useRef(false);
  const streamDoneRef = useRef(true);
  // Concatenation of every clip's text that has finished playing in the
  // current session. Subtitles render as `completedPrefix + active-clip text`
  // so a multi-sentence streamed reply reads as one continuous transcript.
  const completedPrefixRef = useRef('');
  // Resolvers awaiting full drain (one per pending `finish()` / `speak()` /
  // `replay()` call). Fired once the queue is empty AND the stream is closed.
  const finishResolversRef = useRef<Array<() => void>>([]);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    if (audioRef.current) audioRef.current.muted = muted;
  }, []);

  const stopAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    stopAudio();
    for (const item of queueRef.current) {
      if (item.ownsUrl) URL.revokeObjectURL(item.url);
    }
    queueRef.current = [];
    playingRef.current = false;
    streamDoneRef.current = true;
    completedPrefixRef.current = '';
    const resolvers = finishResolversRef.current;
    finishResolversRef.current = [];
    for (const r of resolvers) r();
    setState({mouthShape: 'closed', isSpeaking: false, spokenText: '', currentSpeech: ''});
  }, [stopAudio]);

  const playNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      playingRef.current = false;
      // Only finalize when the producer has explicitly closed the stream.
      // Otherwise we may just be momentarily ahead of TTS fetches.
      if (streamDoneRef.current) {
        const finalText = completedPrefixRef.current;
        setState({
          mouthShape: 'closed',
          isSpeaking: false,
          spokenText: finalText,
          currentSpeech: '',
        });
        const resolvers = finishResolversRef.current;
        finishResolversRef.current = [];
        for (const r of resolvers) r();
      }
      return;
    }

    playingRef.current = true;
    const audio = new Audio(next.url);
    audio.muted = mutedRef.current;
    audioRef.current = audio;

    const segPrefix = completedPrefixRef.current;
    const segText = next.text;
    const joined = segPrefix ? `${segPrefix} ${segText}` : segText;

    setState({
      mouthShape: 'closed',
      isSpeaking: true,
      spokenText: segPrefix,
      currentSpeech: joined,
    });

    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration;
      const totalFrames = Math.ceil(duration * FPS);
      const visemes = textToVisemes(segText, FPS, totalFrames);

      const tick = () => {
        if (audioRef.current !== audio) return;
        const t = audio.currentTime;
        const frame = Math.floor(t * FPS);
        const shape = getMouthShapeAtFrame(visemes, frame);
        const charIdx = getCharIndexAtFrame(segText, totalFrames, frame);
        setState({
          mouthShape: shape,
          isSpeaking: true,
          spokenText: segPrefix ? `${segPrefix} ${segText.slice(0, charIdx)}` : segText.slice(0, charIdx),
          currentSpeech: joined,
        });
        if (!audio.paused && !audio.ended) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };

      audio.play().then(() => {
        rafRef.current = requestAnimationFrame(tick);
      }).catch(() => {/* autoplay blocked etc. */});
    });

    const advance = () => {
      if (audioRef.current !== audio) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      audioRef.current = null;
      completedPrefixRef.current = segPrefix ? `${segPrefix} ${segText}` : segText;
      if (next.ownsUrl) URL.revokeObjectURL(next.url);
      playNext();
    };

    audio.addEventListener('ended', advance);
    audio.addEventListener('error', advance);
  }, []);

  // Begin a streaming session. The caller pushes audio clips with `enqueue`
  // as TTS for each sentence resolves, then calls `finish()` once the chat
  // stream has closed and the last sentence has been enqueued. `finish()`
  // resolves only when the player has drained the queue.
  const beginStream = useCallback(() => {
    cancel();
    streamDoneRef.current = false;

    return {
      enqueue: (text: string, blob: Blob) => {
        if (streamDoneRef.current && !playingRef.current) {
          // Producer already called finish(); ignore late arrivals.
          return;
        }
        const url = URL.createObjectURL(blob);
        queueRef.current.push({text, url, ownsUrl: true});
        if (!playingRef.current) playNext();
      },
      finish: (): Promise<void> => {
        streamDoneRef.current = true;
        if (!playingRef.current && queueRef.current.length === 0) {
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          finishResolversRef.current.push(resolve);
        });
      },
      cancel,
    };
  }, [cancel, playNext]);

  // One-shot helper: speak a fully-resolved reply (used by paths that don't
  // stream — vision, sketch, music, telegram inject).
  const speak = useCallback(
    (text: string, audioBlob: Blob): Promise<void> => {
      const session = beginStream();
      session.enqueue(text, audioBlob);
      return session.finish();
    },
    [beginStream],
  );

  // Replay a previously-stored reply (URL kept on the chat message). We don't
  // own the URL so it survives playback and can be replayed again.
  const replay = useCallback(
    (text: string, audioUrl: string): Promise<void> => {
      cancel();
      streamDoneRef.current = true;
      queueRef.current = [{text, url: audioUrl, ownsUrl: false}];
      return new Promise((resolve) => {
        finishResolversRef.current.push(resolve);
        playNext();
      });
    },
    [cancel, playNext],
  );

  return {
    ...state,
    speak,
    replay,
    setMuted,
    beginStream,
    cancel,
  };
}
