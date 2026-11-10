import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { clothes } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/current_user';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const items = await db
    .select()
    .from(clothes)
    .where(and(eq(clothes.userId, auth.userId), isNull(clothes.deletedAt)));

  const now = Date.now();
  const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;

  const topWorn = [...items]
    .sort((a, b) => b.wearCount - a.wearCount)
    .slice(0, 5)
    .map((c) => ({ clothes_id: c.id, count: c.wearCount }));

  const unworn60d = items
    .filter((c) => !c.lastWornAt || now - c.lastWornAt.getTime() > SIXTY_DAYS)
    .map((c) => ({
      clothes_id: c.id,
      days: c.lastWornAt
        ? Math.floor((now - c.lastWornAt.getTime()) / (24 * 60 * 60 * 1000))
        : -1,
    }));

  const colorDistribution: Record<string, number> = {};
  const categoryDistribution: Record<string, number> = {};
  items.forEach((c) => {
    colorDistribution[c.color] = (colorDistribution[c.color] ?? 0) + 1;
    categoryDistribution[c.category] = (categoryDistribution[c.category] ?? 0) + 1;
  });

  return NextResponse.json({
    top_worn: topWorn,
    unworn_60d: unworn60d,
    color_distribution: colorDistribution,
    category_distribution: categoryDistribution,
    total_items: items.length,
  });
}
