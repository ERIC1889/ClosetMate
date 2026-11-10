import { NextResponse } from 'next/server';

// MVP: Clerk 미도입 상태에서 사용자 식별을 한 곳에 묶어둔다.
// 도입 후에는 이 함수만 Clerk auth() 로 바꾸면 모든 라우트가 함께 안전해진다.
//
// 우선순위:
//   1) Clerk session (도입 시)
//   2) x-user-id 헤더 — 모바일 클라이언트가 보내는 신뢰 헤더(전용 토큰 게이트 추가 예정)
//   3) DEV_FAKE_USER_ID env — 로컬 개발 편의
//
// body/query 의 userId 는 더 이상 신뢰하지 않는다.

export type AuthedUser = { id: string };

export async function getCurrentUserId(req: Request): Promise<string | null> {
  const headerId = req.headers.get('x-user-id');
  if (headerId && /^[0-9a-fA-F-]{36}$/.test(headerId)) return headerId;

  if (process.env.NODE_ENV !== 'production' && process.env.DEV_FAKE_USER_ID) {
    return process.env.DEV_FAKE_USER_ID;
  }
  return null;
}

export async function requireUser(req: Request): Promise<
  { ok: true; userId: string } | { ok: false; response: Response }
> {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true, userId };
}
