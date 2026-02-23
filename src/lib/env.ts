/**
 * FlowOps - Environment Variable Validation
 *
 * 起動時に必須環境変数の存在を検証。
 */

import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),

  // optional
  LLM_PROVIDER: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_BASE_URL: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),

  // ファイルパス設定（デフォルトはspec/配下）
  FLOWS_DIR: z.string().optional(),
  DICT_DIR: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let validated = false;
let cachedEnv: Env | null = null;

/**
 * 環境変数を検証（初回のみ実行）
 * バリデーション成功時のみ型安全なデータを返す。
 * 開発環境では失敗時もデフォルト値で補完して返す。
 */
export function validateEnv(): Env {
  if (validated && cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');

    console.error(`\n[FlowOps] Environment variable validation failed:\n${missing}\n`);

    // 本番では停止
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    // 開発環境: 必須フィールドにフォールバック値を設定
    cachedEnv = {
      DATABASE_URL: process.env.DATABASE_URL || 'file:./prisma/dev.db',
      AUTH_SECRET: process.env.AUTH_SECRET || 'dev-secret-change-me',
      LLM_PROVIDER: process.env.LLM_PROVIDER,
      LLM_API_KEY: process.env.LLM_API_KEY,
      LLM_MODEL: process.env.LLM_MODEL,
      LLM_BASE_URL: process.env.LLM_BASE_URL,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      LOG_LEVEL: (process.env.LOG_LEVEL as Env['LOG_LEVEL']) || undefined,
      NODE_ENV: (process.env.NODE_ENV as Env['NODE_ENV']) || 'development',
      FLOWS_DIR: process.env.FLOWS_DIR,
      DICT_DIR: process.env.DICT_DIR,
    } satisfies Env;
  } else {
    cachedEnv = result.data;
  }

  validated = true;
  return cachedEnv;
}
