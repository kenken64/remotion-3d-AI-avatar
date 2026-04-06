export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendChatMessage(messages: ChatMsg[]): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({messages}),
  });

  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.reply;
}

export async function fetchSpeechAudio(text: string): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text, voice: 'onyx'}),
  });

  if (!res.ok) {
    throw new Error(`TTS request failed: ${res.status}`);
  }

  return res.blob();
}
