import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { clothes } from '@/lib/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/current_user';

const createSchema = z.object({
  imageUrl: z.string().url(),
  category: z.string(),
  color: z.string(),
  style: z.string(),
  brand: z.string().optional(),
  price: z.number().int().optional(),
  modelVersion: z.string().optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  aiPredicted: z.unknown().optional(),
  userCorrected: z.boolean().optional(),
  gptAnalysis: z.record(z.string()).optional(),
});

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const items = await db
    .select()
    .from(clothes)
    .where(and(eq(clothes.userId, auth.userId), isNull(clothes.deletedAt)))
    .orderBy(desc(clothes.createdAt));

  return NextResponse.json({ items, total: items.length });
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [inserted] = await db
    .insert(clothes)
    .values({
      userId: auth.userId,
      imageUrl: parsed.data.imageUrl,
      category: parsed.data.category,
      color: parsed.data.color,
      style: parsed.data.style,
      brand: parsed.data.brand,
      price: parsed.data.price,
      modelVersion: parsed.data.modelVersion,
      aiConfidence: parsed.data.aiConfidence,
      aiPredicted: parsed.data.aiPredicted as object | undefined,
      gptAnalysis: parsed.data.gptAnalysis,
      userCorrected: parsed.data.userCorrected ?? false,
    })
    .returning();

  return NextResponse.json(inserted, { status: 201 });
}
