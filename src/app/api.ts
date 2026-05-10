export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatReply {
  reply: string;
  imageUrl?: string;
}

export async function sendChatMessage(messages: ChatMsg[]): Promise<ChatReply> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({messages}),
  });

  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status}`);
  }

  const data = await res.json();
  return {reply: data.reply, imageUrl: data.imageUrl};
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve) => {
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(audioBlob);
  });

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({audio: base64}),
  });

  if (!res.ok) {
    throw new Error(`Transcription failed: ${res.status}`);
  }

  const data = await res.json();
  return data.text;
}

export interface StreamHandlers {
  onDelta: (delta: string) => void;
  onDone: (info: {full: string; imageUrl?: string}) => void;
  onError?: (err: Error) => void;
}

// Reads the SSE body of /api/chat-stream and dispatches each event to the
// caller. Each `delta` event carries an incremental text fragment; a single
// `done` event carries the assembled full reply and any generated image URL.
export async function streamChatMessage(
  messages: ChatMsg[],
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/chat-stream', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({messages}),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Chat stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    buf += decoder.decode(value, {stream: true});
    let sep;
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (!data) continue;
      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (event === 'delta') handlers.onDelta(String(parsed.text || ''));
      else if (event === 'done') {
        handlers.onDone({full: String(parsed.full || ''), imageUrl: parsed.imageUrl});
        return;
      } else if (event === 'error') {
        handlers.onError?.(new Error(String(parsed.error || 'stream error')));
        return;
      }
    }
  }
}

// Buffers streamed text and flushes one chunk at a time at sentence
// boundaries. We require a minimum length before flushing so abbreviations
// (e.g. "Mr." or "1.5") don't trigger a premature split — the buffer keeps
// growing until a punctuation arrives that would yield a piece long enough
// to be worth speaking.
export function makeSentenceFlusher(
  onSentence: (sentence: string) => void,
  minLength = 20,
) {
  // Punctuation that ends a sentence, possibly followed by a closing quote.
  const BOUNDARY = /[.?!。！？]+["')\]」』]?(?=\s|$)/g;
  let buf = '';

  const tryFlush = () => {
    while (buf.trim().length >= minLength) {
      BOUNDARY.lastIndex = 0;
      let cut = -1;
      let m: RegExpExecArray | null;
      while ((m = BOUNDARY.exec(buf)) !== null) {
        const end = m.index + m[0].length;
        if (buf.slice(0, end).trim().length >= minLength) {
          cut = end;
          break;
        }
      }
      if (cut < 0) return;
      const piece = buf.slice(0, cut).trim();
      buf = buf.slice(cut).replace(/^\s+/, '');
      if (piece) onSentence(piece);
    }
  };

  return {
    push(delta: string) {
      buf += delta;
      tryFlush();
    },
    flush() {
      const tail = buf.trim();
      buf = '';
      if (tail) onSentence(tail);
    },
  };
}

export async function fetchSpeechAudio(text: string): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text}),
  });

  if (!res.ok) {
    throw new Error(`TTS request failed: ${res.status}`);
  }

  return res.blob();
}
