'use client';

import { useRef, useState } from 'react';
import { ArrowUp, Columns2, FileText, Globe, Loader2, Plus, Square, X } from 'lucide-react';
import { compressImage } from '@/lib/image-compress';
import { ACCEPT_ATTR, readDocument, wrapDocument, type AttachedDocument } from '@/lib/documents';

export interface PromptSubmit {
  text: string;
  /** Prompt text with <attached_document> blocks prepended. */
  textWithDocuments: string;
  images: string[]; // JPEG data URLs
  documents: { name: string; estimatedTokens: number }[];
}

interface Props {
  onSubmit: (payload: PromptSubmit) => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  webSearch: boolean;
  onToggleWebSearch: () => void;
  compareMode: boolean;
  onToggleCompare: () => void;
}

export function PromptInput({
  onSubmit,
  onStop,
  disabled,
  streaming,
  webSearch,
  onToggleWebSearch,
  compareMode,
  onToggleCompare,
}: Props) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [docs, setDocs] = useState<AttachedDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  function autoResize() {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }

  async function addFiles(files: File[]) {
    setBusy(true);
    setError('');
    try {
      for (const f of files) {
        if (f.type.startsWith('image/')) {
          const dataUrl = await compressImage(f);
          setImages((prev) => [...prev, dataUrl]);
        } else {
          const doc = await readDocument(f);
          setDocs((prev) => [...prev, doc]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imgs = Array.from(e.clipboardData.items)
      .filter((i) => i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter((f): f is File => !!f);
    if (imgs.length > 0) {
      e.preventDefault();
      void addFiles(imgs);
    }
  }

  const canSend = !disabled && !busy && (text.trim() || images.length > 0 || docs.length > 0);

  function send() {
    if (!canSend) return;
    const docBlocks = docs.map(wrapDocument).join('\n\n');
    onSubmit({
      text,
      textWithDocuments: docBlocks ? `${docBlocks}\n\n${text}` : text,
      images,
      documents: docs.map((d) => ({ name: d.name, estimatedTokens: d.estimatedTokens })),
    });
    setText('');
    setImages([]);
    setDocs([]);
    requestAnimationFrame(autoResize);
  }

  const chip = (active: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
      active
        ? 'border-white/70 bg-white text-black'
        : 'border-line text-muted hover:border-white/25 hover:bg-surface-2 hover:text-white'
    }`;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-line bg-surface p-2.5 shadow-lg shadow-black/50 transition focus-within:border-white/30 sm:rounded-3xl sm:p-3">
        {(docs.length > 0 || images.length > 0) && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {docs.map((d, i) => (
              <span
                key={`${d.name}-${i}`}
                className="flex animate-fade-up items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs"
              >
                <FileText size={12} className="text-white" />
                {d.name} · ~{d.estimatedTokens.toLocaleString()} tokens
                <button aria-label="Remove document" onClick={() => setDocs((p) => p.filter((_, j) => j !== i))}>
                  <X size={12} className="text-muted hover:text-white" />
                </button>
              </span>
            ))}
            {images.map((src, i) => (
              <div key={i} className="relative animate-fade-up">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Pasted screenshot" className="h-16 w-16 rounded-xl border border-line object-cover" />
                <button
                  aria-label="Remove image"
                  onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-surface-2 p-0.5 ring-2 ring-surface"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={areaRef}
          value={text}
          rows={1}
          enterKeyHint="enter"
          placeholder="Ask anything..."
          onChange={(e) => {
            setText(e.target.value);
            autoResize();
          }}
          onPaste={onPaste}
          onKeyDown={(e) => {
            const isMobile =
              typeof window !== 'undefined' &&
              (window.matchMedia('(pointer: coarse)').matches ||
                /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isMobile) {
              e.preventDefault();
              send();
            }
          }}
          className="max-h-48 w-full resize-none bg-transparent px-2 py-1.5 text-base text-white outline-none placeholder:text-muted sm:max-h-56 sm:text-[15px]"
        />

        <div className="mt-1 flex items-center gap-1.5 sm:gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept={`${ACCEPT_ATTR},image/*`}
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <button
            type="button"
            aria-label="Attach file"
            onClick={() => fileRef.current?.click()}
            className="rounded-full p-2 text-muted transition hover:bg-surface-2 hover:text-white"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          </button>
          <button type="button" onClick={onToggleWebSearch} className={chip(webSearch)}>
            <Globe size={13} /> Web Search
          </button>
          <button type="button" onClick={onToggleCompare} className={chip(compareMode)}>
            <Columns2 size={13} /> Compare
          </button>

          <div className="ml-auto">
            {streaming ? (
              <button
                type="button"
                aria-label="Stop"
                onClick={onStop}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:bg-neutral-200"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Send"
                onClick={send}
                disabled={!canSend}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:bg-neutral-200 disabled:bg-surface-2 disabled:text-muted"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-center text-xs text-[#d4d4d4]">{error}</p>}
    </div>
  );
}
