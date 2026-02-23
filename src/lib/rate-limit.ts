/**
 * FlowOps - Rate Limiter
 *
 * インメモリのスライディングウィンドウ方式レート制限。
 * 本番ではRedis等に差し替え可能。
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  /** ウィンドウサイズ（ミリ秒） */
  windowMs: number;
  /** ウィンドウ内の最大リクエスト数 */
  maxRequests: number;
}

const store = new Map<string, RateLimitEntry>();

// 5分ごとに古いエントリを掃除
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => now - t < 600_000);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, 300_000);

/**
 * レート制限チェック
 * @returns remaining が 0 以下ならレート制限超過
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // ウィンドウ外の古いタイムスタンプを除去
  entry.timestamps = entry.timestamps.filter(t => now - t < config.windowMs);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const resetMs = oldestInWindow + config.windowMs - now;
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetMs: config.windowMs,
  };
}

/** テスト用: ストアをクリア */
export function _resetStore(): void {
  store.clear();
}

/** プリセット設定 */
export const RATE_LIMITS = {
  /** 通常API: 60req/min */
  api: { windowMs: 60_000, maxRequests: 60 },
  /** LLM生成: 10req/min（コスト保護） */
  llm: { windowMs: 60_000, maxRequests: 10 },
  /** 認証: 10req/min（ブルートフォース対策） */
  auth: { windowMs: 60_000, maxRequests: 10 },
} as const;
