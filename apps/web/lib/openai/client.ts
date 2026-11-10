import OpenAI from 'openai';

// Lazy 평가: build/page-data 수집 시점에는 OPENAI_API_KEY 가 없을 수 있다.
// 실제 라우트 호출 시점에만 검증한다.
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  _client = new OpenAI({ apiKey: key });
  return _client;
}

// 라우트 코드가 `openai.foo.bar(...)` 로 호출하는 패턴을 유지하기 위한 프록시.
export const openai = new Proxy({} as OpenAI, {
  get(_t, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    return c[prop];
  },
});

// 기획상 nano-first + mini fallback 정책. 실제 모델 ID 는 OpenAI 카탈로그 확인 후
// 환경변수로 채운다. unset 이면 보수적 기본값(gpt-4o-mini / gpt-4o / whisper-1).
export const MODEL_DEFAULT = process.env.OPENAI_MODEL_DEFAULT || 'gpt-4o-mini';
export const MODEL_FALLBACK = process.env.OPENAI_MODEL_FALLBACK || 'gpt-4o';
export const MODEL_TRANSCRIBE = process.env.OPENAI_MODEL_TRANSCRIBE || 'whisper-1';

export const LLM_CONFIDENCE_THRESHOLD = Number(
  process.env.LLM_CONFIDENCE_THRESHOLD ?? '0.7'
);
