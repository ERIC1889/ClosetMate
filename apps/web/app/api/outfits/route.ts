import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { clothes, outfitItems, outfits } from '@/lib/db/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/current_user';

const bodySchema = z.object({
  wornDate: z.string(),
  clothesIds: z.array(z.string().uuid()).min(1).max(12),
  weather: z.record(z.unknown()).nullable().optional(),
  occasion: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // 소유권 검증: 받은 clothesIds 가 전부 인증된 사용자의 옷이고, soft-delete 되지 않았어야 한다.
  const owned = await db
    .select({ id: clothes.id })
    .from(clothes)
    .where(
      and(
        eq(clothes.userId, auth.userId),
        isNull(clothes.deletedAt),
        inArray(clothes.id, data.clothesIds)
      )
    );

  if (owned.length !== data.clothesIds.length) {
    return NextResponse.json(
      { error: 'clothes_ids_not_owned_or_deleted' },
      { status: 403 }
    );
  }

  const result = await db.transaction(async (tx) => {
    const [outfit] = await tx
      .insert(outfits)
      .values({
        userId: auth.userId,
        wornDate: data.wornDate,
        weather: data.weather as object | undefined,
        occasion: data.occasion ?? undefined,
        rating: data.rating ?? undefined,
      })
      .returning();

    await tx.insert(outfitItems).values(
      data.clothesIds.map((clothesId) => ({
        outfitId: outfit.id,
        clothesId,
      }))
    );

    await tx
      .update(clothes)
      .set({
        wearCount: sql`${clothes.wearCount} + 1`,
        lastWornAt: new Date(),
      })
      .where(
        and(eq(clothes.userId, auth.userId), inArray(clothes.id, data.clothesIds))
      );

    return outfit;
  });

  return NextResponse.json(result, { status: 201 });
}
