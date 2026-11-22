export type Provider = 'google' | 'openrouter' | 'groq';

export interface ModelInfo {
  id: string;
  label: string;
  provider: Provider;
  fallback?: string;
  custom?: boolean;
}

export const VISION_MODEL = 'gemini-3.8-flash';
export const LONG_DOC_MODEL = 'gemini-3.8-flash';
export const LONG_DOC_CHAR_LIMIT = 25_000;
/** Fallback used for models that have none configured (e.g. custom OpenRouter models). */
export const DEFAULT_FALLBACK = 'gemini-3.5-flash-lite';

export const MODELS: ModelInfo[] = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', provider: 'google', fallback: 'gemini-3.5-flash-lite' },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite',
    provider: 'google',
    fallback: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    label: 'Nemotron 3 Ultra 550B (Free)',
    provider: 'openrouter',
    fallback: 'gemini-3.8-flash',
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    label: 'Nemotron 3 Nano Reasoning (Free)',
    provider: 'openrouter',
    fallback: 'gemini-3.5-flash-lite',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 31B (Free)',
    provider: 'openrouter',
    fallback: 'gemini-3.5-flash-lite',
  },
  {
    id: 'nvidia/nemotron-3.5-super-vl:free',
    label: 'Nemotron 3.5 Super VL (Free)',
    provider: 'openrouter',
    fallback: 'gemini-3.8-flash',
  },
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)', provider: 'groq', fallback: 'gemini-3.5-flash-lite' },
];

/** Vision fallback differs from the generic fallback of the model. */
export const VISION_FALLBACK = 'nvidia/nemotron-3.5-super-vl:free';

export function getModelInfo(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelLabel(id: string): string {
  return getModelInfo(id)?.label ?? id.split('/').pop() ?? id;
}
