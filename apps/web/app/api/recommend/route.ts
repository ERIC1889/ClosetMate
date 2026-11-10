import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { clothes, outfitItems, outfits, recommendations } from '@/lib/db/schema';
import { and, eq, gte, isNull } from 'drizzle-orm';
import { generateCandidates } from '@/lib/recommend/candidate_generator';
import { runRecommendation } from '@/lib/recommend/runner';
import { fetchWeather } from '@/lib/weather/openweather';
import { requireUser } from '@/lib/auth/current_user';

const RECENT_WINDOW_DAYS = 14;

const bodySchema = z.object({
  query: z.string().min(1),
  context: z
    .object({
      occasion: z.string().nullable().optional(),
      location: z
        .object({ lat: z.number(), lng: z.number() })
        .nullable()
        .optional(),
      calendarSummary: z.record(z.unknown()).nullable().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { query, context } = parsed.data;

  const wardrobe = await db
    .select()
    .from(clothes)
    .where(and(eq(clothes.userId, auth.userId), isNull(clothes.deletedAt)));

  if (wardrobe.length < 4) {
    return NextResponse.json(
      { error: '추천을 위해서는 최소 4벌의 옷이 필요합니다.' },
      { status: 400 }
    );
  }

  const weather = context?.location
    ? await fetchWeather(context.location.lat, context.location.lng)
    : null;

  // 최근 N일 안에 착용한 옷 ID — 동일 옷이 연이어 추천되지 않도록 후보 점수에 패널티.
  const cutoff = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const cutoffDateStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD (worn_date 는 date 타입)
  const recentRows = await db
    .select({ clothesId: outfitItems.clothesId })
    .from(outfitItems)
    .innerJoin(outfits, eq(outfits.id, outfitItems.outfitId))
    .where(and(eq(outfits.userId, auth.userId), gte(outfits.wornDate, cutoffDateStr)));
  const recentClothesIds = Array.from(new Set(recentRows.map((r) => r.clothesId)));

  const candidates = generateCandidates({
    wardrobe,
    weather,
    occasion: context?.occasion ?? null,
    recentClothesIds,
  });

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: '조건에 맞는 후보 조합을 만들 수 없습니다.' },
      { status: 422 }
    );
  }

  const wardrobeMap = new Map(wardrobe.map((c) => [c.id, c]));

  const result = await runRecommendation({
    query,
    occasion: context?.occasion ?? null,
    weather,
    candidates,
    wardrobeMap,
  });

  await db.insert(recommendations).values({
    userId: auth.userId,
    query,
    contextSnapshot: {
      occasion: context?.occasion ?? null,
      weather,
      candidatesCount: candidates.length,
      recentClothesCount: recentClothesIds.length,
    },
    recommendedOutfits: result.data.outfits,
    gptReasoning: result.data.outfits.map((o) => o.reason).join('\n---\n'),
    modelUsed: result.modelUsed,
    modelConfidence: result.data.model_confidence,
    fallbackTriggered: result.fallbackTriggered,
  });

  return NextResponse.json({
    recommendations: result.data.outfits,
    candidates_generated: candidates.length,
    model_used: result.modelUsed,
    model_confidence: result.data.model_confidence,
    fallback_triggered: result.fallbackTriggered,
    fallback_reason: result.fallbackReason,
    tokens: result.tokens,
    latency_ms: result.latencyMs,
  });
}
