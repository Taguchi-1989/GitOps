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
});

export type Env = z.infer<typeof envSchema>;

let validated = false;

/**
 * 環境変数を検証（初回のみ実行）
 */
export function validateEnv(): Env {
  if (validated) return process.env as unknown as Env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');

    console.error(`\n[FlowOps] Environment variable validation failed:\n${missing}\n`);

    // 開発環境では警告のみ、本番では停止
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  validated = true;
  return (result.success ? result.data : process.env) as Env;
}
