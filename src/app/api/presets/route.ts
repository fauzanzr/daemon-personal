import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { presets } from '@/db/schema';

export async function GET() {
  const rows = await db.select().from(presets).orderBy(asc(presets.createdAt));
  return Response.json(rows);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string;
    systemPrompt?: string;
    defaultModel?: string;
  } | null;

  if (!body?.name?.trim() || !body?.systemPrompt?.trim()) {
    return Response.json({ error: 'Name and systemPrompt are required' }, { status: 400 });
  }

  const [created] = await db
    .insert(presets)
    .values({
      name: body.name.trim().slice(0, 80),
      description: body.description?.trim().slice(0, 200) || null,
      systemPrompt: body.systemPrompt.trim(),
      defaultModel: body.defaultModel || 'gemini-3.8-flash',
    })
    .returning();
  return Response.json(created, { status: 201 });
}
