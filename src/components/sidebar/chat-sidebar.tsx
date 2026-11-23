'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogOut, Pin, Plus, Search, Settings, Trash2, X } from 'lucide-react';
import { DaemonLogo } from '@/components/brand/daemon-logo';

export interface ChatSummary {
  id: string;
  title: string;
  modelId: string;
  isPinned: boolean;
  updatedAt: string;
}

interface Props {
  chats: ChatSummary[];
  activeChatId?: string;
  open: boolean;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onSearch: (q: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

function Group({
  title,
  items,
  props,
}: {
  title: string;
  items: ChatSummary[];
  props: Pick<Props, 'activeChatId' | 'onTogglePin' | 'onDelete' | 'onCloseMobile'>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="pb-3">
      <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted">{title}</p>
      {items.map((c) => {
        const active = c.id === props.activeChatId;
        return (
          <div
            key={c.id}
            className={`group flex items-center gap-1 rounded-xl pr-2 text-sm transition ${
              active ? 'bg-surface-2 text-white' : 'text-[#b5b5b5] hover:bg-surface hover:text-white'
            }`}
          >
            <Link
              href={`/chat/${c.id}`}
              onClick={props.onCloseMobile}
              className="min-w-0 flex-1 truncate px-3 py-2"
            >
              {c.title}
            </Link>
            <button
              onClick={() => props.onTogglePin(c.id, !c.isPinned)}
              title={c.isPinned ? 'Unpin' : 'Pin'}
              className={`rounded-full p-1.5 transition ${
                c.isPinned ? 'text-white' : 'text-muted opacity-100 hover:text-white md:opacity-0 md:group-hover:opacity-100'
              }`}
            >
              <Pin size={13} />
            </button>
            <button
              onClick={() => props.onDelete(c.id)}
              title="Delete"
              className="rounded-full p-1.5 text-muted opacity-100 transition hover:text-white md:opacity-0 md:group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ChatSidebar({
  chats,
  activeChatId,
  open,
  onCloseMobile,
  onNewChat,
  onSearch,
  onTogglePin,
  onDelete,
  onOpenSettings,
}: Props) {
  const [query, setQuery] = useState('');

  async function logout() {
    sessionStorage.removeItem('daemon_tab_session');
    await fetch('/api/auth', { method: 'DELETE' });
    window.location.replace('/login');
  }

  const shared = { activeChatId, onTogglePin, onDelete, onCloseMobile };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/65 backdrop-blur-[2px] md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 h-dvh w-72 max-w-[82vw] shrink-0 overflow-hidden border-r border-line bg-[#0f0f0f] transition-transform duration-300 ease-out md:static md:z-auto md:max-w-none md:translate-x-0 md:transition-[width] ${
          open ? 'translate-x-0 md:w-72' : '-translate-x-full md:w-0 md:border-r-0'
        }`}
      >
        <div className="flex h-dvh w-full flex-col p-3 md:w-72">
          <div className="mb-3 flex items-center justify-between px-1.5 pt-0.5">
            <div className="flex items-center gap-2.5">
              <div className="overflow-hidden rounded-lg border border-white/10">
                <DaemonLogo size={24} />
              </div>
              <span className="text-sm font-medium tracking-tight text-white">Daemon Personal</span>
            </div>
            <button
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              className="rounded-full p-1.5 text-muted transition hover:bg-surface hover:text-white md:hidden"
            >
              <X size={16} />
            </button>
          </div>

          <button
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-white transition hover:bg-surface-2"
          >
            <Plus size={15} /> New chat
          </button>

          <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
            <Search size={14} className="text-muted" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onSearch(e.target.value);
              }}
              placeholder="Search chats"
              className="w-full bg-transparent text-base text-white outline-none placeholder:text-muted sm:text-sm"
            />
          </div>

          <nav className="-mr-1 flex-1 overflow-y-auto pr-1">
            {chats.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted">No chat history yet.</p>}
            <Group title="Pinned" items={chats.filter((c) => c.isPinned)} props={shared} />
            <Group title="Recent" items={chats.filter((c) => !c.isPinned)} props={shared} />
          </nav>

          <div className="flex items-center justify-between border-t border-line pb-[env(safe-area-inset-bottom)] pt-2.5 text-sm text-muted">
            <button
              onClick={() => {
                onCloseMobile();
                onOpenSettings();
              }}
              className="flex items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-surface hover:text-white"
            >
              <Settings size={15} /> Settings
            </button>
            <button
              onClick={() => void logout()}
              title="Sign out"
              className="rounded-xl p-2 transition hover:bg-surface hover:text-white"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
