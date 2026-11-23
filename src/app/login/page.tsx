'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { WaterRipples } from '@/components/auth/water-ripples';
import { DaemonLogo } from '@/components/brand/daemon-logo';

const TAB_SESSION_KEY = 'daemon_tab_session';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Ensure a clean empty form and clear any stale tab session flag on mount
  useEffect(() => {
    setPin('');
    sessionStorage.removeItem(TAB_SESSION_KEY);
  }, []);

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
        sessionStorage.setItem(TAB_SESSION_KEY, '1');
        window.location.replace('/');
      } else {
        setError('Invalid PIN. Please try again.');
        setPin('');
        setBusy(false);
      }
    } catch {
      setError('Failed to connect to server.');
      setBusy(false);
    }
  }

  const maskStyle = !show ? ({ WebkitTextSecurity: 'disc' } as CSSProperties) : undefined;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-4 py-12">
      <WaterRipples />

      {/* Subtle radial matte vignette for focus */}
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{ background: 'radial-gradient(circle at center, transparent 15%, rgba(11,11,11,0.75) 85%)' }}
      />

      <div className="relative z-10 w-full max-w-[356px] animate-fade-up">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 rounded-2xl border border-white/10 p-0.5 shadow-xl shadow-black/70">
            <DaemonLogo size={54} className="rounded-[13px]" />
          </div>
          <h1 className="text-2xl font-light tracking-tight text-white">Sign in to Daemon Personal</h1>
          <p className="mt-1.5 text-xs text-muted">Enter your access PIN to unlock your workspace</p>
        </div>

        {error && (
          <div className="mb-4 animate-fade-up rounded-xl border border-white/20 bg-[#141414]/90 px-4 py-3 text-xs text-[#e5e5e5] backdrop-blur-md">
            {error}
          </div>
        )}

        <form
          onSubmit={submit}
          autoComplete="off"
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#121212]/80 p-6 shadow-2xl shadow-black/70 backdrop-blur-xl"
        >
          {/* Delicate top matte highlight */}
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          <label htmlFor="daemon-access-code" className="mb-2 block text-xs font-medium text-[#d4d4d4]">
            Access PIN
          </label>
          <div className="relative mb-5">
            <input
              id="daemon-access-code"
              name="daemon_access_code"
              type="text"
              inputMode="text"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError('');
              }}
              placeholder="Enter PIN"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              style={maskStyle}
              className="w-full rounded-xl border border-white/10 bg-[#0b0b0b]/90 px-3.5 py-2.5 pr-10 text-sm text-white outline-none transition placeholder:text-muted/70 focus:border-white/40"
            />
            <button
              type="button"
              tabIndex={-1}
              aria-label={show ? 'Hide PIN' : 'Show PIN'}
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-white"
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={busy || !pin.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-35"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? 'Verifying...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 rounded-2xl border border-white/10 bg-[#121212]/60 px-4 py-3 text-center text-xs text-muted backdrop-blur-md">
          <span className="inline-flex items-center gap-1.5">
            <Lock size={12} /> Session ends automatically when tab or browser closes
          </span>
        </div>
      </div>
    </main>
  );
}
