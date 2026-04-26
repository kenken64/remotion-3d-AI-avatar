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

export async function fetchSpeechAudio(text: string): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text, voice: 'nova'}),
  });

  if (!res.ok) {
    throw new Error(`TTS request failed: ${res.status}`);
  }

  return res.blob();
}
