'use client';

import { useState } from 'react';
import { Boxes, Download, KeyRound, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { loadByokKeys, saveByokKeys, type ByokKeys } from '@/lib/byok';
import { loadCustomModels, saveCustomModels, useModels } from '@/lib/custom-models';

export interface PresetItem {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  defaultModel: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  presets: PresetItem[];
  onPresetsChange: () => void;
}

type Tab = 'keys' | 'models' | 'presets' | 'backup';

const input =
  'w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-white/40';

export function SettingsModal({ open, onClose, presets, onPresetsChange }: Props) {
  const models = useModels();
  const [tab, setTab] = useState<Tab>('keys');
  const [keys, setKeys] = useState<ByokKeys>(() => loadByokKeys());
  const [savedNotice, setSavedNotice] = useState(false);

  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPrompt, setPPrompt] = useState('');
  const [pModel, setPModel] = useState('gemini-3.8-flash');
  const [pBusy, setPBusy] = useState(false);

  const [cmId, setCmId] = useState('');
  const [cmLabel, setCmLabel] = useState('');

  if (!open) return null;

  function handleSaveKeys(e: React.FormEvent) {
    e.preventDefault();
    saveByokKeys(keys);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  }

  async function createPreset(e: React.FormEvent) {
    e.preventDefault();
    if (!pName.trim() || !pPrompt.trim()) return;
    setPBusy(true);
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pName, description: pDesc, systemPrompt: pPrompt, defaultModel: pModel }),
      });
      if (res.ok) {
        setPName('');
        setPDesc('');
        setPPrompt('');
        onPresetsChange();
      }
    } finally {
      setPBusy(false);
    }
  }

  async function deletePreset(id: string) {
    const res = await fetch(`/api/presets/${id}`, { method: 'DELETE' });
    if (res.ok) onPresetsChange();
  }

  function addCustomModel(e: React.FormEvent) {
    e.preventDefault();
    const id = cmId.trim();
    if (!id.includes('/')) return;
    const current = loadCustomModels().map((m) => ({ id: m.id, label: m.label }));
    if (current.some((m) => m.id === id)) return;
    saveCustomModels([...current, { id, label: cmLabel.trim() || id.split('/').pop() || id }]);
    setCmId('');
    setCmLabel('');
  }

  function removeCustomModel(id: string) {
    saveCustomModels(loadCustomModels().filter((m) => m.id !== id).map((m) => ({ id: m.id, label: m.label })));
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'keys', label: 'API Keys', icon: <KeyRound size={14} /> },
    { id: 'models', label: 'Model OpenRouter', icon: <Boxes size={14} /> },
    { id: 'presets', label: 'Preset', icon: <SlidersHorizontal size={14} /> },
    { id: 'backup', label: 'Backup', icon: <Download size={14} /> },
  ];

  const customModels = models.filter((m) => m.custom);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl animate-fade-up flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-base font-semibold text-white">Pengaturan</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted transition hover:bg-surface-2 hover:text-white">
            <X size={17} />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-line px-5 py-2.5 text-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
                tab === t.id ? 'bg-white font-medium text-black' : 'text-muted hover:bg-surface-2 hover:text-white'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'keys' && (
            <form onSubmit={handleSaveKeys} className="space-y-4" autoComplete="off">
              <p className="text-xs leading-relaxed text-muted">
                Key disimpan hanya di browser (<code>localStorage</code>) dan dikirim lewat header saat request. Kosongkan
                untuk memakai key default dari <code>.env.local</code>.
              </p>
              {(
                [
                  ['google', 'Google AI Studio', 'AIzaSy...'],
                  ['openrouter', 'OpenRouter', 'sk-or-v1-...'],
                  ['groq', 'Groq', 'gsk_...'],
                  ['tavily', 'Tavily Search (Web Search)', 'tvly-...'],
                ] as const
              ).map(([field, label, placeholder]) => (
                <div key={field} className="space-y-1.5">
                  <label className="text-xs font-medium text-[#d4d4d4]">{label}</label>
                  <input
                    type="password"
                    name={`byok-${field}`}
                    autoComplete="new-password"
                    value={keys[field]}
                    onChange={(e) => setKeys((prev) => ({ ...prev, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className={input}
                  />
                </div>
              ))}
              <div className="flex items-center gap-3 pt-1">
                <button className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-neutral-200">
                  Simpan
                </button>
                {savedNotice && <span className="text-xs text-white">Tersimpan di browser.</span>}
              </div>
            </form>
          )}

          {tab === 'models' && (
            <div className="space-y-5">
              <p className="text-xs leading-relaxed text-muted">
                Tambahkan model apa pun dari <span className="text-white underline">openrouter.ai/models</span> (mis.{' '}
                <code>openai/gpt-4.1</code>, <code>anthropic/claude-sonnet-4.5</code>). Model berbayar membutuhkan saldo
                OpenRouter.
              </p>
              <form onSubmit={addCustomModel} className="space-y-2.5 rounded-2xl border border-line p-4">
                <input
                  value={cmId}
                  onChange={(e) => setCmId(e.target.value)}
                  placeholder="Model ID, mis. openai/gpt-4.1"
                  className={input}
                />
                <input
                  value={cmLabel}
                  onChange={(e) => setCmLabel(e.target.value)}
                  placeholder="Nama tampilan (opsional)"
                  className={input}
                />
                <button
                  disabled={!cmId.includes('/')}
                  className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
                >
                  <Plus size={14} /> Tambah model
                </button>
              </form>
              <div className="space-y-2">
                {customModels.length === 0 && <p className="text-sm text-muted">Belum ada model kustom.</p>}
                {customModels.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{m.label}</p>
                      <p className="truncate font-mono text-xs text-muted">{m.id}</p>
                    </div>
                    <button onClick={() => removeCustomModel(m.id)} className="text-muted hover:text-white" aria-label="Hapus model">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'presets' && (
            <div className="space-y-5">
              <form onSubmit={(e) => void createPreset(e)} className="space-y-2.5 rounded-2xl border border-line p-4">
                <p className="text-sm font-medium text-white">Preset baru</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Nama preset" className={input} />
                  <select value={pModel} onChange={(e) => setPModel(e.target.value)} className={input}>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input value={pDesc} onChange={(e) => setPDesc(e.target.value)} placeholder="Deskripsi (opsional)" className={input} />
                <textarea
                  value={pPrompt}
                  onChange={(e) => setPPrompt(e.target.value)}
                  rows={3}
                  placeholder="System prompt..."
                  className={input}
                />
                <button
                  disabled={pBusy || !pName.trim() || !pPrompt.trim()}
                  className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
                >
                  <Plus size={14} /> Simpan preset
                </button>
              </form>
              <div className="space-y-2">
                {presets.length === 0 && <p className="text-sm text-muted">Belum ada preset.</p>}
                {presets.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-line p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{p.name}</p>
                      {p.description && <p className="text-xs text-muted">{p.description}</p>}
                      <p className="mt-1 line-clamp-2 text-xs text-muted/80">{p.systemPrompt}</p>
                    </div>
                    <button onClick={() => void deletePreset(p.id)} className="text-muted hover:text-white" aria-label="Hapus preset">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'backup' && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Unduh seluruh riwayat chat, alternatif jawaban, dan preset dari Neon PostgreSQL dalam satu klik.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/api/chats/export?format=json"
                  className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
                >
                  <Download size={15} /> Backup (.json)
                </a>
                <a
                  href="/api/chats/export?format=md"
                  className="flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-medium text-white transition hover:bg-surface-2"
                >
                  <Download size={15} /> Versi baca (.md)
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
