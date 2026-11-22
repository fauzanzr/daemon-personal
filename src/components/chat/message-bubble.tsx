'use client';

import { useState } from 'react';
import { Check, ChevronDown, Copy, FileText, Terminal, Wand2 } from 'lucide-react';
import type { UIMessage } from 'ai';
import { Markdown } from './markdown';
import { useModels } from '@/lib/custom-models';
import { modelLabel } from '@/lib/models';

const DOC_RE = /<attached_document name="([^"]*)">[\s\S]*?<\/attached_document>\s*/g;

export function messageText(m: UIMessage): string {
  return m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
}

interface Props {
  message: UIMessage;
  modelUsed?: string;
  webLabel?: string;
  onRevise?: (reviewerModelId: string) => void;
  busy?: boolean;
}

export function MessageBubble({ message, modelUsed, webLabel, onRevise, busy }: Props) {
  const models = useModels();
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const raw = messageText(message);

  if (message.role === 'user') {
    const docs = Array.from(raw.matchAll(DOC_RE)).map((m) => m[1]);
    const text = raw.replace(DOC_RE, '').trim();
    const images = message.parts.filter((p) => p.type === 'file' && p.mediaType.startsWith('image/'));
    return (
      <div className="flex animate-fade-up justify-end">
        <div className="max-w-[85%] space-y-2 rounded-3xl rounded-br-lg border border-line bg-surface-2 px-5 py-3 text-[15px] leading-relaxed text-white">
          {docs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {docs.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-0.5 text-xs">
                  <FileText size={12} /> {d}
                </span>
              ))}
            </div>
          )}
          {images.map((p, i) =>
            p.type === 'file' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p.url} alt="Screenshot" className="max-h-52 rounded-2xl border border-line" />
            ) : null,
          )}
          {text && <p className="whitespace-pre-wrap">{text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex animate-fade-up gap-3.5">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-surface">
        <Terminal size={13} className="text-white" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-[15px]">
          <Markdown>{raw || '...'}</Markdown>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted opacity-75 transition group-hover:opacity-100">
          <button
            onClick={() => {
              void navigator.clipboard.writeText(raw);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 transition hover:bg-surface hover:text-white"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Disalin' : 'Salin'}
          </button>
          {onRevise && (
            <div className="relative">
              <button
                disabled={busy}
                onClick={() => setMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 transition hover:bg-surface hover:text-white disabled:opacity-40"
              >
                <Wand2 size={13} /> Revisi dengan model lain <ChevronDown size={12} />
              </button>
              {menu && (
                <div className="absolute bottom-full left-0 z-20 mb-1 max-h-72 w-64 animate-fade-up overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-2xl shadow-black/70">
                  {models
                    .filter((m) => m.id !== modelUsed)
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setMenu(false);
                          onRevise(m.id);
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[#e5e5e5] transition hover:bg-surface-2"
                      >
                        {m.label}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
          {modelUsed && (
            <span className="ml-auto flex items-center gap-1.5 px-2">
              {webLabel && (
                <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-[#d4d4d4]">
                  {webLabel}
                </span>
              )}
              {modelLabel(modelUsed)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
