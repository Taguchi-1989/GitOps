/**
 * FlowOps - Environment Variable Validation Tests
 *
 * Tests for env.ts: schema validation, caching, defaults, and error handling.
 * Uses vi.resetModules() + dynamic import() to reset internal module state
 * (validated / cachedEnv) between tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('validateEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Restore a clean copy of process.env before each test
    process.env = { ...originalEnv };
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns validated env when all required vars are present', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/testdb';
    process.env.AUTH_SECRET = 'my-secret-key';
    (process.env as Record<string, string>).NODE_ENV = 'test';

    const { validateEnv } = await import('@/lib/env');
    const env = validateEnv();

    expect(env.DATABASE_URL).toBe('postgresql://localhost:5432/testdb');
    expect(env.AUTH_SECRET).toBe('my-secret-key');
    expect(env.NODE_ENV).toBe('test');
  });

  it('returns cached env on subsequent calls (same module instance)', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/testdb';
    process.env.AUTH_SECRET = 'my-secret-key';
    (process.env as Record<string, string>).NODE_ENV = 'test';

    const { validateEnv } = await import('@/lib/env');
    const first = validateEnv();

    // Mutate process.env after first call - should NOT affect cached result
    process.env.DATABASE_URL = 'changed-url';
    const second = validateEnv();

    expect(second).toBe(first); // same reference (cached)
    expect(second.DATABASE_URL).toBe('postgresql://localhost:5432/testdb');
  });

  it('falls back to defaults in development when required vars are missing', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    (process.env as Record<string, string>).NODE_ENV = 'development';

    const { validateEnv } = await import('@/lib/env');
    const env = validateEnv();

    expect(env.DATABASE_URL).toBe('file:./prisma/dev.db');
    expect(env.AUTH_SECRET).toBe('dev-secret-change-me');
    expect(env.NODE_ENV).toBe('development');
    expect(console.error).toHaveBeenCalled();
  });

  it('calls process.exit(1) in production when required vars are missing', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    (process.env as Record<string, string>).NODE_ENV = 'production';

    const { validateEnv } = await import('@/lib/env');

    expect(() => validateEnv()).toThrow('process.exit');
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalled();
  });

  it('logs descriptive error messages when validation fails', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    (process.env as Record<string, string>).NODE_ENV = 'development';

    const { validateEnv } = await import('@/lib/env');
    validateEnv();

    const errorOutput = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(errorOutput).toContain('[FlowOps]');
    expect(errorOutput).toContain('Environment variable validation failed');
  });

  it('handles optional LLM vars when present', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/testdb';
    process.env.AUTH_SECRET = 'my-secret-key';
    process.env.LLM_PROVIDER = 'openai';
    process.env.LLM_API_KEY = 'sk-test-key';
    process.env.LLM_MODEL = 'gpt-4';
    process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
    (process.env as Record<string, string>).NODE_ENV = 'test';

    const { validateEnv } = await import('@/lib/env');
    const env = validateEnv();

    expect(env.LLM_PROVIDER).toBe('openai');
    expect(env.LLM_API_KEY).toBe('sk-test-key');
    expect(env.LLM_MODEL).toBe('gpt-4');
    expect(env.LLM_BASE_URL).toBe('https://api.openai.com/v1');
  });

  it('accepts valid LOG_LEVEL enum values', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/testdb';
    process.env.AUTH_SECRET = 'my-secret-key';
    process.env.LOG_LEVEL = 'warn';
    (process.env as Record<string, string>).NODE_ENV = 'test';

    const { validateEnv } = await import('@/lib/env');
    const env = validateEnv();

    expect(env.LOG_LEVEL).toBe('warn');
  });

  it('rejects invalid LOG_LEVEL enum values and falls back', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/testdb';
    process.env.AUTH_SECRET = 'my-secret-key';
    process.env.LOG_LEVEL = 'verbose'; // invalid
    (process.env as Record<string, string>).NODE_ENV = 'development';

    const { validateEnv } = await import('@/lib/env');
    const env = validateEnv();

    // validation fails, falls back to default env construction
    expect(console.error).toHaveBeenCalled();
    // The fallback casts LOG_LEVEL as-is, but it was invalid so it won't match the enum
    // The important thing is that console.error was called reporting the issue
    expect(env.DATABASE_URL).toBe('postgresql://localhost:5432/testdb');
  });

  it('rejects LLM_BASE_URL when it is not a valid URL', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/testdb';
    process.env.AUTH_SECRET = 'my-secret-key';
    process.env.LLM_BASE_URL = 'not-a-url';
    (process.env as Record<string, string>).NODE_ENV = 'development';

    const { validateEnv } = await import('@/lib/env');
    const env = validateEnv();

    // validation fails because LLM_BASE_URL is not a valid URL
    expect(console.error).toHaveBeenCalled();
    const errorOutput = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(errorOutput).toContain('LLM_BASE_URL');
    // Falls back to process.env value in default construction
    expect(env.LLM_BASE_URL).toBe('not-a-url');
  });

  it('returns undefined for optional vars when they are not set', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/testdb';
    process.env.AUTH_SECRET = 'my-secret-key';
    (process.env as Record<string, string>).NODE_ENV = 'test';
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_API_KEY;
    delete process.env.FLOWS_DIR;
    delete process.env.DICT_DIR;

    const { validateEnv } = await import('@/lib/env');
    const env = validateEnv();

    expect(env.LLM_PROVIDER).toBeUndefined();
    expect(env.LLM_API_KEY).toBeUndefined();
    expect(env.FLOWS_DIR).toBeUndefined();
    expect(env.DICT_DIR).toBeUndefined();
  });
});
