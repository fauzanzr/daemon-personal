'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, Terminal } from 'lucide-react';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        setError('PIN tidak valid. Silakan periksa kembali.');
        setBusy(false);
      }
    } catch {
      setError('Gagal terhubung ke server.');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-[340px] animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-surface">
            <Terminal size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-light tracking-tight text-white">Sign in to Daemon Personal</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-white/20 bg-surface px-4 py-3 text-xs text-[#e5e5e5]">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="rounded-xl border border-line bg-surface p-5 shadow-2xl shadow-black/60">
          <label htmlFor="pin-input" className="mb-2 block text-xs font-medium text-[#d4d4d4]">
            Access PIN
          </label>
          <div className="relative mb-4">
            <input
              id="pin-input"
              type={show ? 'text' : 'password'}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError('');
              }}
              placeholder="Masukkan PIN"
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-lg border border-line bg-bg px-3.5 py-2 pr-10 text-sm text-white outline-none transition focus:border-white/50"
            />
            <button
              type="button"
              tabIndex={-1}
              aria-label={show ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              onClick={() => setShow((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition hover:text-white"
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={busy || !pin.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? 'Memverifikasi...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 rounded-xl border border-line/70 px-4 py-3 text-center text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Lock size={12} /> Private single-user AI workspace
          </span>
        </div>
      </div>
    </main>
  );
}
