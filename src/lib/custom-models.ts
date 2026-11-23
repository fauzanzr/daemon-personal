'use client';

import { useEffect, useState } from 'react';
import { MODELS, DEFAULT_FALLBACK, DEFAULT_CONTEXT_WINDOW, type ModelInfo } from './models';

const KEY = 'daemon_personal_custom_models';
const EVENT = 'daemon-custom-models-changed';

export function loadCustomModels(): ModelInfo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as { id: string; label: string }[];
    return raw.map((m) => ({
      id: m.id,
      label: m.label || m.id,
      provider: 'openrouter',
      fallback: DEFAULT_FALLBACK,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      custom: true,
    }));
  } catch {
    return [];
  }
}

export function saveCustomModels(list: { id: string; label: string }[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

/** Built-in models + user-defined OpenRouter models. */
export function useModels(): ModelInfo[] {
  const [custom, setCustom] = useState<ModelInfo[]>([]);
  useEffect(() => {
    const sync = () => setCustom(loadCustomModels());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return [...MODELS, ...custom];
}
