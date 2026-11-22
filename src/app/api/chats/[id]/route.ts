import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chats, messages } from '@/db/schema';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const [chat] = await db.select().from(chats).where(eq(chats.id, id));
  if (!chat) return Response.json({ error: 'Chat not found' }, { status: 404 });

  const msgs = await db.select().from(messages).where(eq(messages.chatId, id)).orderBy(asc(messages.createdAt));
  return Response.json({ chat, messages: msgs });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    isPinned?: boolean;
    modelId?: string;
    systemPrompt?: string | null;
  };

  const patch: Partial<typeof chats.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 120) || 'Untitled';
  if (typeof body.isPinned === 'boolean') patch.isPinned = body.isPinned;
  if (typeof body.modelId === 'string') patch.modelId = body.modelId;
  if (body.systemPrompt !== undefined) patch.systemPrompt = body.systemPrompt;

  const [updated] = await db.update(chats).set(patch).where(eq(chats.id, id)).returning();
  if (!updated) return Response.json({ error: 'Chat not found' }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const [deleted] = await db.delete(chats).where(eq(chats.id, id)).returning();
  if (!deleted) return Response.json({ error: 'Chat not found' }, { status: 404 });
  return Response.json({ ok: true });
}
