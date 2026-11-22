'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useModels } from '@/lib/custom-models';
import { modelLabel, type Provider } from '@/lib/models';
import type { TrafficState } from '@/lib/model-health';

const PROVIDER_LABEL: Record<Provider, string> = { google: 'Google', openrouter: 'OpenRouter', groq: 'Groq' };

type HealthMap = Record<string, { state: TrafficState; reason?: string }>;

export function ModelSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const models = useModels();
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<HealthMap>({});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch('/api/models/status')
      .then((r) => (r.ok ? (r.json() as Promise<HealthMap>) : null))
      .then((d) => {
        if (d) setHealth(d);
      })
      .catch(() => {});
  }, [open]);

  const currentStatus = health[value];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-[#f2f2f2] transition hover:bg-surface"
      >
        <span>{modelLabel(value)}</span>
        {currentStatus?.state === 'high_traffic' && (
          <span className="rounded-full border border-white/20 px-1.5 py-0.5 text-[10px] font-normal text-[#b5b5b5]">
            High traffic
          </span>
        )}
        <ChevronDown size={14} className={`text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 max-h-96 w-80 animate-fade-up overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-2xl shadow-black/70">
          {(['google', 'openrouter', 'groq'] as Provider[]).map((p) => {
            const list = models.filter((m) => m.provider === p);
            if (list.length === 0) return null;
            return (
              <div key={p} className="pb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                  {PROVIDER_LABEL[p]}
                </p>
                {list.map((m) => {
                  const st = health[m.id];
                  const badge =
                    st?.state === 'high_traffic' ? 'High traffic' : st?.state === 'busy' ? 'Ramai' : null;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onChange(m.id);
                        setOpen(false);
                      }}
                      title={st?.reason}
                      className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-surface-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[#f2f2f2]">{m.label}</p>
                        {st?.reason && st.state !== 'normal' && (
                          <p className="truncate text-[11px] text-muted">{st.reason}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {badge && (
                          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-[#d4d4d4]">
                            {badge}
                          </span>
                        )}
                        {m.id === value && <Check size={14} className="text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
