import { asc, desc } from 'drizzle-orm';
import { db } from '@/db';
import { chats, messages, presets } from '@/db/schema';

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get('format') === 'md' ? 'md' : 'json';
  const [allChats, allMessages, allPresets] = await Promise.all([
    db.select().from(chats).orderBy(desc(chats.updatedAt)),
    db.select().from(messages).orderBy(asc(messages.createdAt)),
    db.select().from(presets).orderBy(asc(presets.createdAt)),
  ]);

  const byChat = new Map<string, typeof allMessages>();
  for (const m of allMessages) {
    const arr = byChat.get(m.chatId) ?? [];
    arr.push(m);
    byChat.set(m.chatId, arr);
  }

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'md') {
    const parts: string[] = [`# Daemon Personal Backup (${stamp})`, ''];
    for (const c of allChats) {
      parts.push(`## ${c.title}`, `- Model: \`${c.modelId}\``, `- Updated: ${c.updatedAt.toISOString()}`, '');
      for (const m of byChat.get(c.id) ?? []) {
        const label = m.role === 'user' ? 'User' : `Assistant (${m.modelUsed ?? c.modelId})`;
        parts.push(`### ${label}`, '', m.content, '');
      }
      parts.push('---', '');
    }
    return new Response(parts.join('\n'), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="daemon-personal-backup-${stamp}.md"`,
      },
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    chats: allChats.map((c) => ({ ...c, messages: byChat.get(c.id) ?? [] })),
    presets: allPresets,
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="daemon-personal-backup-${stamp}.json"`,
    },
  });
}
