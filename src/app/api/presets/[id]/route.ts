import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { presets } from '@/db/schema';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string | null;
    systemPrompt?: string;
    defaultModel?: string;
  };
  const patch: Partial<typeof presets.$inferInsert> = {};
  if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 80);
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (typeof body.systemPrompt === 'string') patch.systemPrompt = body.systemPrompt.trim();
  if (typeof body.defaultModel === 'string') patch.defaultModel = body.defaultModel;

  const [updated] = await db.update(presets).set(patch).where(eq(presets.id, id)).returning();
  if (!updated) return Response.json({ error: 'Preset not found' }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const [deleted] = await db.delete(presets).where(eq(presets.id, id)).returning();
  if (!deleted) return Response.json({ error: 'Preset not found' }, { status: 404 });
  return Response.json({ ok: true });
}
