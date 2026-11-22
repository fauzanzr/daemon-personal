'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type FileUIPart, type UIMessage } from 'ai';
import { PanelLeft, Terminal } from 'lucide-react';
import { PromptInput, type PromptSubmit } from './prompt-input';
import { MessageBubble, messageText } from './message-bubble';
import { ModelSelector } from './model-selector';
import { Markdown } from './markdown';
import { ChatSidebar, type ChatSummary } from '@/components/sidebar/chat-sidebar';
import { SettingsModal, type PresetItem } from '@/components/sidebar/settings-modal';
import { modelLabel } from '@/lib/models';
import { useModels } from '@/lib/custom-models';
import { streamChatText } from '@/lib/chat-client';
import { getByokHeaders } from '@/lib/byok';

interface CompareItem {
  modelId: string;
  text: string;
  done: boolean;
  error?: string;
  modelUsed?: string | null;
  searchMode?: string | null;
}

interface DbMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelUsed: string | null;
  alternatives: { modelId: string; content: string }[] | null;
}

const uid = () => crypto.randomUUID();

function buildUserMessage(p: PromptSubmit): UIMessage {
  const files: FileUIPart[] = p.images.map((url) => ({ type: 'file', mediaType: 'image/jpeg', url }));
  return {
    id: uid(),
    role: 'user',
    parts: [...files, { type: 'text', text: p.textWithDocuments }],
  };
}

function buildAttachmentMeta(p: PromptSubmit) {
  const docs = p.documents.map((d) => ({ type: 'document' as const, name: d.name, tokenEstimate: d.estimatedTokens }));
  const imgs = p.images.map((_, i) => ({ type: 'image' as const, name: `screenshot-${i + 1}.jpg` }));
  const all = [...docs, ...imgs];
  return all.length > 0 ? all : undefined;
}

function getLoadingReason(seconds: number, modelId: string, webSearch: boolean): string {
  const name = modelLabel(modelId);
  if (webSearch && seconds < 4) return 'Mencari informasi terbaru di web...';
  if (seconds < 5) return `Menghubungi ${name}...`;
  if (seconds < 12) return `${name} sedang memproses atau mengalami antrean (high traffic)...`;
  return `Antrean padat di ${name}, mencoba respons atau beralih ke model cadangan...`;
}

export function ChatInterface({ initialChatId }: { initialChatId?: string }) {
  const router = useRouter();
  const models = useModels();
  const [chatId, setChatId] = useState<string | undefined>(initialChatId);
  const chatIdRef = useRef<string | undefined>(initialChatId);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [presets, setPresets] = useState<PresetItem[]>([]);

  const [modelId, setModelId] = useState('gemini-3.8-flash');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [activePresetId, setActivePresetId] = useState('');
  const [slidingWindow, setSlidingWindow] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareModels, setCompareModels] = useState<string[]>([
    'gemini-3.8-flash',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
  ]);
  const [compare, setCompare] = useState<CompareItem[] | null>(null);
  const [modelUsed, setModelUsed] = useState<Record<string, string>>({});
  const [searchUsed, setSearchUsed] = useState<Record<string, string>>({});
  const [alternatives, setAlternatives] = useState<Record<string, { modelId: string; content: string }[]>>({});
  const [reviseBusy, setReviseBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [waitSeconds, setWaitSeconds] = useState(0);

  const settings = useRef({ modelId, slidingWindow, webSearch, systemPrompt });
  useEffect(() => {
    settings.current = { modelId, slidingWindow, webSearch, systemPrompt };
  }, [modelId, slidingWindow, webSearch, systemPrompt]);
  const lastModelUsed = useRef<string | null>(null);
  const lastSearchMode = useRef<string | null>(null);

  const loadChats = useCallback(async (q = '') => {
    const url = q.trim() ? `/api/chats?q=${encodeURIComponent(q.trim())}` : '/api/chats';
    const res = await fetch(url);
    if (res.ok) setChats((await res.json()) as ChatSummary[]);
  }, []);

  const loadPresets = useCallback(async () => {
    const res = await fetch('/api/presets');
    if (res.ok) setPresets((await res.json()) as PresetItem[]);
  }, []);

  useEffect(() => {
    void loadChats();
    void loadPresets();
  }, [loadChats, loadPresets]);

  async function saveMessageToDb(
    targetChatId: string,
    payload: {
      role: 'user' | 'assistant';
      content: string;
      modelUsed?: string | null;
      revisionType?: 'initial' | 'critique' | 'side_by_side';
      attachments?: { type: 'document' | 'image'; name: string; tokenEstimate?: number }[];
      alternatives?: { modelId: string; content: string }[];
    },
  ) {
    await fetch(`/api/chats/${targetChatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    void loadChats();
  }

  async function ensureChat(firstPrompt: string): Promise<string> {
    if (chatIdRef.current) return chatIdRef.current;
    const title = firstPrompt.replace(/\s+/g, ' ').trim().slice(0, 60) || 'New Chat';
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        modelId: settings.current.modelId,
        systemPrompt: settings.current.systemPrompt || null,
      }),
    });
    const created = (await res.json()) as ChatSummary;
    chatIdRef.current = created.id;
    setChatId(created.id);
    window.history.replaceState(null, '', `/chat/${created.id}`);
    void loadChats();
    return created.id;
  }

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: () => ({
          modelId: settings.current.modelId,
          slidingWindow: settings.current.slidingWindow,
          webSearch: settings.current.webSearch,
          systemPrompt: settings.current.systemPrompt || undefined,
        }),
        headers: () => getByokHeaders(),
        fetch: async (input, init) => {
          const res = await fetch(input, init);
          lastModelUsed.current = res.headers.get('x-model-used');
          lastSearchMode.current = res.headers.get('x-web-search');
          if (lastSearchMode.current === 'no-key') {
            setNotice('Web Search memerlukan Tavily API Key gratis di Pengaturan -> API Keys.');
          }
          return res;
        },
      }),
    [],
  );

  const { messages, setMessages, sendMessage, status, stop, error } = useChat({
    transport,
    onFinish: ({ message }) => {
      const used = lastModelUsed.current ?? settings.current.modelId;
      setModelUsed((m) => ({ ...m, [message.id]: used }));
      if (lastSearchMode.current && lastSearchMode.current !== 'off' && lastSearchMode.current !== 'no-key') {
        setSearchUsed((s) => ({ ...s, [message.id]: lastSearchMode.current! }));
      }
      if (chatIdRef.current) {
        void saveMessageToDb(chatIdRef.current, {
          role: 'assistant',
          content: messageText(message),
          modelUsed: used,
          revisionType: 'initial',
        });
      }
    },
  });

  const waitingFirstToken = status === 'submitted';

  useEffect(() => {
    if (!waitingFirstToken) {
      setWaitSeconds(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setWaitSeconds(Math.floor((Date.now() - start) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [waitingFirstToken]);

  useEffect(() => {
    chatIdRef.current = initialChatId;
    setChatId(initialChatId);
    if (!initialChatId) {
      setMessages([]);
      setCompare(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/chats/${initialChatId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { chat: ChatSummary & { systemPrompt: string | null }; messages: DbMessage[] } | null) => {
        if (cancelled || !data) return;
        setModelId(data.chat.modelId);
        setSystemPrompt(data.chat.systemPrompt ?? '');
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            parts: [{ type: 'text', text: m.content }],
          })),
        );
        const mu: Record<string, string> = {};
        const alt: Record<string, { modelId: string; content: string }[]> = {};
        for (const m of data.messages) {
          if (m.modelUsed) mu[m.id] = m.modelUsed;
          if (m.alternatives?.length) alt[m.id] = m.alternatives;
        }
        setModelUsed(mu);
        setAlternatives(alt);
      });
    return () => {
      cancelled = true;
    };
  }, [initialChatId, setMessages]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, compare]);

  const streaming = status === 'submitted' || status === 'streaming';
  const compareRunning = !!compare && compare.some((c) => !c.done);

  async function handleSubmit(p: PromptSubmit) {
    setNotice('');
    const activeId = await ensureChat(p.text || p.documents[0]?.name || 'Screenshot');
    void saveMessageToDb(activeId, {
      role: 'user',
      content: p.textWithDocuments,
      attachments: buildAttachmentMeta(p),
    });

    if (!compareMode) {
      const files: FileUIPart[] = p.images.map((url) => ({ type: 'file', mediaType: 'image/jpeg', url }));
      void sendMessage({ text: p.textWithDocuments, files });
      return;
    }

    const userMsg = buildUserMessage(p);
    const history = [...messages, userMsg];
    setMessages(history);
    const targets = compareModels;
    setCompare(targets.map((id) => ({ modelId: id, text: '', done: false })));

    await Promise.all(
      targets.map(async (id, idx) => {
        const patch = (u: Partial<CompareItem>) =>
          setCompare((prev) => prev && prev.map((c, i) => (i === idx ? { ...c, ...u } : c)));
        try {
          const r = await streamChatText(
            {
              messages: history,
              modelId: id,
              slidingWindow,
              webSearch,
              systemPrompt: systemPrompt || undefined,
            },
            (text) => patch({ text }),
          );
          patch({ text: r.text, done: true, modelUsed: r.modelUsed, searchMode: r.searchMode });
        } catch (e) {
          patch({ done: true, error: e instanceof Error ? e.message : String(e) });
        }
      }),
    );
  }

  function selectMain(index: number) {
    if (!compare) return;
    const chosen = compare[index];
    const id = uid();
    const used = chosen.modelUsed ?? chosen.modelId;
    const archived = compare
      .filter((_, i) => i !== index && !compare[i].error)
      .map((c) => ({ modelId: c.modelUsed ?? c.modelId, content: c.text }));

    setMessages((prev) => [...prev, { id, role: 'assistant', parts: [{ type: 'text', text: chosen.text }] }]);
    setModelUsed((m) => ({ ...m, [id]: used }));
    if (chosen.searchMode && chosen.searchMode !== 'off' && chosen.searchMode !== 'no-key') {
      setSearchUsed((s) => ({ ...s, [id]: chosen.searchMode! }));
    }
    setAlternatives((a) => ({ ...a, [id]: archived }));
    setCompare(null);

    if (chatIdRef.current) {
      void saveMessageToDb(chatIdRef.current, {
        role: 'assistant',
        content: chosen.text,
        modelUsed: used,
        revisionType: 'side_by_side',
        alternatives: archived,
      });
    }
  }

  async function revise(messageIndex: number, reviewerId: string) {
    const answer = messages[messageIndex];
    const question = [...messages.slice(0, messageIndex)].reverse().find((m) => m.role === 'user');
    if (!question) return;
    const newId = uid();
    setReviseBusy(true);
    setMessages((prev) => [...prev, { id: newId, role: 'assistant', parts: [{ type: 'text', text: '' }] }]);
    const update = (text: string) =>
      setMessages((prev) => prev.map((m) => (m.id === newId ? { ...m, parts: [{ type: 'text', text }] } : m)));
    try {
      const r = await streamChatText(
        {
          mode: 'revise',
          modelId: reviewerId,
          webSearch,
          revise: {
            originalQuestion: messageText(question),
            previousAnswer: messageText(answer),
            previousModel: modelUsed[answer.id] ?? modelId,
          },
        },
        update,
      );
      update(r.text);
      const used = r.modelUsed ?? reviewerId;
      setModelUsed((m) => ({ ...m, [newId]: used }));
      if (chatIdRef.current) {
        void saveMessageToDb(chatIdRef.current, {
          role: 'assistant',
          content: r.text,
          modelUsed: used,
          revisionType: 'critique',
        });
      }
    } catch (e) {
      update(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setReviseBusy(false);
    }
  }

  function toggleCompareModel(id: string) {
    setCompareModels((prev) => {
      if (prev.includes(id)) return prev.length > 2 ? prev.filter((x) => x !== id) : prev;
      if (prev.length >= 3) {
        setNotice('Maksimal 3 model untuk Compare.');
        return prev;
      }
      return [...prev, id];
    });
  }

  function applyPreset(presetId: string) {
    setActivePresetId(presetId);
    const p = presets.find((x) => x.id === presetId);
    if (!p) {
      setSystemPrompt('');
      return;
    }
    setSystemPrompt(p.systemPrompt);
    setModelId(p.defaultModel);
  }

  async function togglePin(id: string, isPinned: boolean) {
    await fetch(`/api/chats/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPinned }),
    });
    void loadChats();
  }

  async function deleteChat(id: string) {
    await fetch(`/api/chats/${id}`, { method: 'DELETE' });
    if (chatIdRef.current === id) {
      chatIdRef.current = undefined;
      setChatId(undefined);
      setMessages([]);
      router.push('/');
    }
    void loadChats();
  }

  const STARTERS = [
    'Jelaskan konsep async/await di JavaScript dengan contoh sederhana',
    'Berita teknologi AI terbaru minggu ini',
    'Bantu saya menulis email profesional untuk meminta cuti',
    'Buatkan rencana belajar TypeScript selama 4 minggu',
  ];
  const webLabelFor = (id: string) =>
    searchUsed[id] ? (searchUsed[id] === 'google-grounding' ? 'Google Search' : 'Web · Tavily') : undefined;

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <ChatSidebar
        chats={chats}
        activeChatId={chatId}
        open={sidebarOpen}
        onNewChat={() => {
          chatIdRef.current = undefined;
          setChatId(undefined);
          setMessages([]);
          setCompare(null);
          router.push('/');
        }}
        onSearch={(q) => void loadChats(q)}
        onTogglePin={(id, pin) => void togglePin(id, pin)}
        onDelete={(id) => void deleteChat(id)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-1 border-b border-line/60 px-3 py-2.5">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-full p-2 text-muted transition hover:bg-surface hover:text-white"
            title="Sidebar"
          >
            <PanelLeft size={18} />
          </button>
          <ModelSelector value={modelId} onChange={setModelId} />
          {presets.length > 0 && (
            <select
              value={activePresetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="max-w-40 rounded-full bg-transparent px-3 py-1.5 text-sm text-muted outline-none transition hover:bg-surface hover:text-white"
            >
              <option value="" className="bg-surface">
                Prompt default
              </option>
              {presets.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface">
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <label className="ml-auto flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted transition hover:bg-surface hover:text-white">
            <input
              type="checkbox"
              checked={slidingWindow}
              onChange={(e) => setSlidingWindow(e.target.checked)}
              className="accent-white"
            />
            Hemat token (10 pesan)
          </label>
        </header>

        {compareMode && (
          <div className="flex animate-fade-up flex-wrap items-center gap-2 border-b border-line/60 px-5 py-2.5 text-xs text-muted">
            <span>Bandingkan 2-3 model:</span>
            {models.map((m) => {
              const on = compareModels.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleCompareModel(m.id)}
                  className={`rounded-full border px-3 py-1 transition ${
                    on ? 'border-white bg-white font-medium text-black' : 'border-line hover:border-white/30 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4">
          {messages.length === 0 && !compare ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center pb-16">
              <div className="mb-8 animate-fade-up text-center">
                <h2 className="text-3xl font-medium tracking-tight text-white sm:text-4xl">
                  Halo, ada yang bisa dibantu?
                </h2>
                <p className="mt-3 text-sm text-muted">
                  Aktifkan Web Search untuk informasi terkini, atau lampirkan dokumen dan screenshot.
                </p>
              </div>
              <div className="grid w-full max-w-2xl gap-2.5 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    disabled={streaming}
                    onClick={() => void handleSubmit({ text: s, textWithDocuments: s, images: [], documents: [] })}
                    className="animate-fade-up rounded-2xl border border-line bg-surface px-4 py-3.5 text-left text-sm text-[#d4d4d4] transition hover:border-white/25 hover:bg-surface-2 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-8 py-6">
              {messages.map((m, i) => (
                <div key={m.id} className="space-y-3">
                  <MessageBubble
                    message={m}
                    modelUsed={modelUsed[m.id]}
                    webLabel={webLabelFor(m.id)}
                    busy={streaming || reviseBusy}
                    onRevise={m.role === 'assistant' && messageText(m) ? (id) => void revise(i, id) : undefined}
                  />
                  {alternatives[m.id]?.length ? (
                    <details className="ml-10 text-xs text-muted">
                      <summary className="cursor-pointer select-none hover:text-white">
                        {alternatives[m.id].length} jawaban alternatif diarsipkan
                      </summary>
                      {alternatives[m.id].map((a) => (
                        <div key={a.modelId} className="mt-2 rounded-2xl border border-line bg-surface p-4">
                          <p className="mb-2 font-medium text-white">{modelLabel(a.modelId)}</p>
                          <Markdown>{a.content}</Markdown>
                        </div>
                      ))}
                    </details>
                  ) : null}
                </div>
              ))}

              {waitingFirstToken && (
                <div className="flex animate-fade-up items-start gap-3.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-surface">
                    <Terminal size={13} className="animate-pulse text-white" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 pt-1.5">
                    <span className="flex items-center gap-1">
                      {[0, 150, 300].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 animate-dot rounded-full bg-white"
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </span>
                    <span className="text-xs text-muted">
                      {getLoadingReason(waitSeconds, modelId, webSearch)}
                    </span>
                    {waitSeconds >= 2 && (
                      <span className="font-mono text-[11px] text-muted/70">{waitSeconds}d</span>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-2xl border border-white/20 bg-surface px-4 py-3 text-sm text-[#e5e5e5]">
                  Error: {error.message}
                </p>
              )}

              {compare && (
                <div
                  className="grid max-w-none gap-3"
                  style={{ gridTemplateColumns: `repeat(${compare.length}, minmax(0, 1fr))` }}
                >
                  {compare.map((c, i) => (
                    <div
                      key={c.modelId}
                      className="flex animate-fade-up flex-col rounded-2xl border border-line bg-surface p-4"
                    >
                      <p className="mb-3 flex flex-wrap items-center gap-1.5 text-sm font-medium text-white">
                        {modelLabel(c.modelId)}
                        {c.modelUsed && c.modelUsed !== c.modelId && (
                          <span className="text-xs font-normal text-muted">(fallback: {modelLabel(c.modelUsed)})</span>
                        )}
                        {c.searchMode && c.searchMode !== 'off' && c.searchMode !== 'no-key' && (
                          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-normal text-[#d4d4d4]">
                            {c.searchMode === 'google-grounding' ? 'Google Search' : 'Web'}
                          </span>
                        )}
                      </p>
                      <div className="flex-1 text-sm">
                        {c.error ? (
                          <p className="text-[#d4d4d4]">Error: {c.error}</p>
                        ) : c.text ? (
                          <Markdown>{c.text}</Markdown>
                        ) : (
                          <p className="text-xs text-muted">Menunggu respons {modelLabel(c.modelId)}...</p>
                        )}
                      </div>
                      <button
                        disabled={!c.done || !!c.error}
                        onClick={() => selectMain(i)}
                        className="mt-4 rounded-full bg-white py-2 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-30"
                      >
                        Pilih sebagai jawaban utama
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </main>

        <footer className="px-4 pb-5 pt-2">
          {notice && <p className="mb-2 text-center text-xs text-[#d4d4d4]">{notice}</p>}
          <PromptInput
            onSubmit={(p) => void handleSubmit(p)}
            onStop={() => void stop()}
            streaming={streaming}
            disabled={streaming || compareRunning || reviseBusy}
            webSearch={webSearch}
            onToggleWebSearch={() => setWebSearch((v) => !v)}
            compareMode={compareMode}
            onToggleCompare={() => setCompareMode((v) => !v)}
          />
          <p className="mt-2 text-center text-[11px] text-muted/70">
            AI bisa keliru. Jangan kirim data rahasia ke model gratis.
          </p>
        </footer>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        presets={presets}
        onPresetsChange={() => void loadPresets()}
      />
    </div>
  );
}
