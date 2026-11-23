export type Provider = 'google' | 'openrouter' | 'groq';

export interface ModelInfo {
  id: string;
  label: string;
  provider: Provider;
  fallback?: string;
  /** Approximate context window in tokens for usage meter. */
  contextWindow: number;
  custom?: boolean;
}

export const VISION_MODEL = 'gemini-3.8-flash';
export const LONG_DOC_MODEL = 'gemini-3.8-flash';
export const LONG_DOC_CHAR_LIMIT = 25_000;
/** Fallback used for models that have none configured (e.g. custom OpenRouter models). */
export const DEFAULT_FALLBACK = 'gemini-3.5-flash-lite';
export const DEFAULT_CONTEXT_WINDOW = 128_000;

export const MODELS: ModelInfo[] = [
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    provider: 'google',
    fallback: 'gemini-3.5-flash-lite',
    contextWindow: 1_000_000,
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite',
    provider: 'google',
    fallback: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    contextWindow: 1_000_000,
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    label: 'Nemotron 3 Ultra 550B (Free)',
    provider: 'openrouter',
    fallback: 'gemini-3.8-flash',
    contextWindow: 128_000,
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    label: 'Nemotron 3 Nano Reasoning (Free)',
    provider: 'openrouter',
    fallback: 'gemini-3.5-flash-lite',
    contextWindow: 128_000,
  },
  {
    id: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 31B (Free)',
    provider: 'openrouter',
    fallback: 'gemini-3.5-flash-lite',
    contextWindow: 128_000,
  },
  {
    id: 'nvidia/nemotron-3.5-super-vl:free',
    label: 'Nemotron 3.5 Super VL (Free)',
    provider: 'openrouter',
    fallback: 'gemini-3.8-flash',
    contextWindow: 128_000,
  },
  {
    id: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B (Groq)',
    provider: 'groq',
    fallback: 'gemini-3.5-flash-lite',
    contextWindow: 128_000,
  },
];

/** Vision fallback differs from the generic fallback of the model. */
export const VISION_FALLBACK = 'nvidia/nemotron-3.5-super-vl:free';

export function getModelInfo(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

export function getContextWindow(id: string): number {
  return getModelInfo(id)?.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
}

export function modelLabel(id: string): string {
  return getModelInfo(id)?.label ?? id.split('/').pop() ?? id;
}
