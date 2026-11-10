import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Lazy 평가: build / page-data 수집 시점에는 DATABASE_URL 이 없을 수 있다.
// 실제 쿼리 호출 시점에 connection 을 만든다.
type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;
let _db: DrizzleClient | null = null;
function getDb(): DrizzleClient {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const queryClient = postgres(connectionString, { prepare: false });
  _db = drizzle(queryClient, { schema });
  return _db;
}

// 기존 호출부(`db.select()...`)를 유지하기 위한 프록시.
type AnyFn = (...args: unknown[]) => unknown;
export const db = new Proxy({} as DrizzleClient, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as AnyFn).bind(real) : value;
  },
});

export type Database = DrizzleClient;
