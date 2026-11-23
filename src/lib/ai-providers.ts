import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { getModelInfo, type Provider } from './models';

export * from './models';

export interface ProviderKeys {
  google?: string | null;
  openrouter?: string | null;
  groq?: string | null;
  tavily?: string | null;
}

/** Reads BYOK headers, falling back to server env keys. */
export function keysFromRequest(req: Request): ProviderKeys {
  return {
    google: req.headers.get('x-google-key') || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    openrouter: req.headers.get('x-openrouter-key') || process.env.OPENROUTER_API_KEY,
    groq: req.headers.get('x-groq-key') || process.env.GROQ_API_KEY,
    tavily: req.headers.get('x-tavily-key') || process.env.TAVILY_API_KEY,
  };
}

export function getProvider(modelId: string): Provider {
  return getModelInfo(modelId)?.provider ?? (modelId.includes('/') ? 'openrouter' : 'google');
}

export function createGoogleClient(keys: ProviderKeys) {
  return createGoogleGenerativeAI({ apiKey: keys.google ?? undefined });
}

export function resolveModel(modelId: string, keys: ProviderKeys): LanguageModel {
  const provider = getProvider(modelId);

  switch (provider) {
    case 'google':
      return createGoogleClient(keys)(modelId);
    case 'openrouter':
      return createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: keys.openrouter ?? undefined,
        name: 'openrouter',
      }).chat(modelId);
    case 'groq':
      return createOpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: keys.groq ?? undefined,
        name: 'groq',
      }).chat(modelId);
  }
}

export function isRateLimitError(err: unknown): boolean {
  const e = err as { statusCode?: number; status?: number; message?: string; cause?: unknown } | undefined;
  if (!e) return false;
  if (e.statusCode === 429 || e.status === 429) return true;
  const msg = String(e.message ?? '').toLowerCase();
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('resource_exhausted') || msg.includes('quota')) {
    return true;
  }
  return e.cause ? isRateLimitError(e.cause) : false;
}

/** Triggers automatic model fallback on 429 rate limits OR 503/high-demand/unavailable errors. */
export function shouldFallbackError(err: unknown): boolean {
  if (isRateLimitError(err)) return true;
  const e = err as { statusCode?: number; status?: number; message?: string; cause?: unknown } | undefined;
  if (!e) return false;
  if (e.statusCode === 503 || e.status === 503 || e.statusCode === 502 || e.status === 502) return true;
  if (e.statusCode === 402 || e.status === 402 || e.statusCode === 413 || e.status === 413) return true;
  const msg = String(e.message ?? '').toLowerCase();
  if (
    msg.includes('request too large') ||
    msg.includes('tokens per minute') ||
    msg.includes('credits') ||
    msg.includes('no longer available') ||
    msg.includes('not a valid model') ||
    msg.includes('does not exist') ||
    msg.includes('insufficient') ||
    msg.includes('payment required') ||
    msg.includes('503') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('provider returned error') ||
    msg.includes('no endpoints found') ||
    msg.includes('try again later')
  ) {
    return true;
  }
  return e.cause ? shouldFallbackError(e.cause) : false;
}
