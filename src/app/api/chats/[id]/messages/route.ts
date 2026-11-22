import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { chats, messages } from '@/db/schema';

type Ctx = { params: Promise<{ id: string }> };

interface MessageInput {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelUsed?: string | null;
  revisionType?: 'initial' | 'critique' | 'side_by_side';
  parentMessageId?: string | null;
  /** Text-only metadata (NEVER store Base64 images in PostgreSQL). */
  attachments?: { type: 'document' | 'image'; name: string; tokenEstimate?: number }[];
  alternatives?: { modelId: string; content: string }[];
}

export async function POST(req: Request, ctx: Ctx) {
  const { id: chatId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as MessageInput | null;
  if (!body || !body.role || typeof body.content !== 'string') {
    return Response.json({ error: 'Invalid message payload' }, { status: 400 });
  }

  // Strip any accidental data URLs from attachments metadata to enforce Text-Only Storage Policy.
  const safeAttachments = body.attachments?.map((a) => ({
    type: a.type,
    name: a.name.slice(0, 200),
    ...(a.tokenEstimate !== undefined ? { tokenEstimate: a.tokenEstimate } : {}),
  }));

  const [saved] = await db
    .insert(messages)
    .values({
      ...(body.id ? { id: body.id } : {}),
      chatId,
      role: body.role,
      content: body.content,
      modelUsed: body.modelUsed ?? null,
      revisionType: body.revisionType ?? 'initial',
      parentMessageId: body.parentMessageId ?? null,
      attachments: safeAttachments ?? null,
      alternatives: body.alternatives ?? null,
    })
    .returning();

  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));
  return Response.json(saved, { status: 201 });
}
