import { afterEach, describe, expect, it } from 'vitest';
import { isAuthDisabled } from './auth-mode';

describe('isAuthDisabled', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAuthDisabled = process.env.AUTH_DISABLED;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    process.env.AUTH_DISABLED = originalAuthDisabled;
  });

  it('allows an explicit bypass in local development', () => {
    (process.env as Record<string, string>).NODE_ENV = 'development';
    process.env.AUTH_DISABLED = 'true';
    expect(isAuthDisabled()).toBe(true);
  });

  it('never disables authentication in production', () => {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    process.env.AUTH_DISABLED = 'true';
    expect(isAuthDisabled()).toBe(false);
  });
});
