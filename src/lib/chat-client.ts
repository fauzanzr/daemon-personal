import { getByokHeaders } from './byok';

/** Streams /api/chat and returns the full text; used by Compare and Revise (outside useChat). */
export async function streamChatText(
  body: unknown,
  onText: (full: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; modelUsed: string | null; searchMode: string | null }> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getByokHeaders() },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }
  const modelUsed = res.headers.get('x-model-used');
  const searchMode = res.headers.get('x-web-search');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const chunk = JSON.parse(payload) as { type: string; delta?: string; errorText?: string };
        if (chunk.type === 'text-delta' && chunk.delta) {
          text += chunk.delta;
          onText(text);
        } else if (chunk.type === 'error') {
          throw new Error(chunk.errorText ?? 'Stream error');
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  return { text, modelUsed, searchMode };
}
