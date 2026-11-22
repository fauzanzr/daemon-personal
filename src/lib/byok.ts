export interface ByokKeys {
  google: string;
  openrouter: string;
  groq: string;
  tavily: string;
}

const STORAGE_KEY = 'daemon_personal_byok_keys';

export const EMPTY_KEYS: ByokKeys = { google: '', openrouter: '', groq: '', tavily: '' };

export function loadByokKeys(): ByokKeys {
  if (typeof window === 'undefined') return EMPTY_KEYS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_KEYS;
    return { ...EMPTY_KEYS, ...(JSON.parse(raw) as Partial<ByokKeys>) };
  } catch {
    return EMPTY_KEYS;
  }
}

export function saveByokKeys(keys: ByokKeys): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function getByokHeaders(): Record<string, string> {
  const k = loadByokKeys();
  const headers: Record<string, string> = {};
  if (k.google.trim()) headers['x-google-key'] = k.google.trim();
  if (k.openrouter.trim()) headers['x-openrouter-key'] = k.openrouter.trim();
  if (k.groq.trim()) headers['x-groq-key'] = k.groq.trim();
  if (k.tavily.trim()) headers['x-tavily-key'] = k.tavily.trim();
  return headers;
}
