import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { clothes } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/current_user';

const patchSchema = z.object({
  category: z.string().min(1).max(40).optional(),
  color: z.string().min(1).max(40).optional(),
  style: z.string().min(1).max(40).optional(),
  brand: z.string().max(80).nullable().optional(),
  price: z.number().int().min(0).max(10_000_000).nullable().optional(),
  userCorrected: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

async function findOwned(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(clothes)
    .where(and(eq(clothes.id, id), eq(clothes.userId, userId), isNull(clothes.deletedAt)))
    .limit(1);
  return row;
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const row = await findOwned(auth.userId, id);
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const existing = await findOwned(auth.userId, id);
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // 라벨이 한 줄이라도 바뀌면 자동으로 userCorrected=true 로 잡아 신뢰도 배지를 해제한다.
  const labelChanged =
    (parsed.data.category && parsed.data.category !== existing.category) ||
    (parsed.data.color && parsed.data.color !== existing.color) ||
    (parsed.data.style && parsed.data.style !== existing.style);

  const [updated] = await db
    .update(clothes)
    .set({
      category: parsed.data.category ?? existing.category,
      color: parsed.data.color ?? existing.color,
      style: parsed.data.style ?? existing.style,
      brand: parsed.data.brand === undefined ? existing.brand : parsed.data.brand,
      price: parsed.data.price === undefined ? existing.price : parsed.data.price,
      userCorrected: parsed.data.userCorrected ?? (labelChanged ? true : existing.userCorrected),
      updatedAt: new Date(),
    })
    .where(eq(clothes.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const existing = await findOwned(auth.userId, id);
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [updated] = await db
    .update(clothes)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(clothes.id, id))
    .returning({ id: clothes.id, deletedAt: clothes.deletedAt });
  return NextResponse.json(updated);
}
