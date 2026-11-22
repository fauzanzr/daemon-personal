import { desc, ilike } from 'drizzle-orm';
import { db } from '@/db';
import { chats } from '@/db/schema';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim();
  const rows = q
    ? await db
        .select()
        .from(chats)
        .where(ilike(chats.title, `%${q}%`))
        .orderBy(desc(chats.isPinned), desc(chats.updatedAt))
    : await db.select().from(chats).orderBy(desc(chats.isPinned), desc(chats.updatedAt));

  return Response.json(rows);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    modelId?: string;
    systemPrompt?: string | null;
  };
  const title = (body.title?.trim() || 'New Chat').slice(0, 120);
  const [created] = await db
    .insert(chats)
    .values({
      title,
      modelId: body.modelId || 'gemini-3.8-flash',
      systemPrompt: body.systemPrompt ?? null,
    })
    .returning();
  return Response.json(created, { status: 201 });
}
