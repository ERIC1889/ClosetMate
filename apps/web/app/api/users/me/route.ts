import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/current_user';

// MVP: 모바일이 앱 부트 시 호출하는 lazy upsert.
// Clerk 도입 전까지는 x-user-id 헤더의 UUID 를 users.id 와 clerk_id 양쪽에 그대로 박는다.
// Clerk 붙이면 clerk_id 는 진짜 Clerk 식별자로 바뀌고, requireUser 만 교체하면 된다.

const bodySchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(80).optional(),
  stylePreferences: z.record(z.unknown()).optional(),
});

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const [row] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!row) {
    return NextResponse.json({ error: 'not_found', userId: auth.userId }, { status: 404 });
  }
  return NextResponse.json(row);
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  if (existing) {
    const update: Partial<typeof existing> = {};
    if (parsed.data.email) update.email = parsed.data.email;
    if (parsed.data.name) update.name = parsed.data.name;
    if (parsed.data.stylePreferences)
      update.stylePreferences = parsed.data.stylePreferences;
    if (Object.keys(update).length === 0) {
      return NextResponse.json(existing);
    }
    const [updated] = await db
      .update(users)
      .set(update)
      .where(eq(users.id, auth.userId))
      .returning();
    return NextResponse.json(updated);
  }

  const [inserted] = await db
    .insert(users)
    .values({
      id: auth.userId,
      clerkId: auth.userId, // Clerk 도입 전 placeholder. unique 제약 충족.
      email: parsed.data.email ?? `user-${auth.userId}@dev.local`,
      name: parsed.data.name,
      stylePreferences: parsed.data.stylePreferences,
    })
    .returning();
  return NextResponse.json(inserted, { status: 201 });
}
