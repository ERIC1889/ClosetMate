import * as SecureStore from 'expo-secure-store';

// MVP: Clerk 도입 전, 디바이스마다 UUID 한 개를 secure store 에 보관해 stable user id 로 쓴다.
// Clerk 도입 시 이 모듈은 제거하고 ClerkProvider 의 session.userId 를 사용한다.
//
// 우선순위:
//   1) SecureStore 에 저장된 값
//   2) EXPO_PUBLIC_DEV_USER_ID (개발 중 동일 user 로 web/mobile 묶고 싶을 때)
//   3) 새로 생성한 crypto UUID — SecureStore 에 저장
//
// crypto.randomUUID() 는 Hermes 0.74+ 에 표준 탑재 (RN 0.85). polyfill 불필요.

const KEY = 'closetmate.userId';

function generateUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // 폴백: RFC4122 v4 비슷한 형태. 운영용은 아님.
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
    c === 'y' ? ((parseInt(hex(), 16) & 0x3) | 0x8).toString(16) : hex(),
  );
}

export async function getOrCreateUserId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing) return existing;
  } catch {
    // SecureStore 가 사용 불가한 환경(웹 미리보기 등) — env 또는 신규로 폴백.
  }

  const envId = process.env.EXPO_PUBLIC_DEV_USER_ID;
  const next = envId && /^[0-9a-fA-F-]{36}$/.test(envId) ? envId : generateUuid();

  try {
    await SecureStore.setItemAsync(KEY, next);
  } catch {
    // 저장 실패해도 in-memory 로는 이번 세션은 동작.
  }
  return next;
}

export async function clearUserId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
