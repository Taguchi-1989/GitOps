/**
 * FlowOps - Logger Tests
 *
 * Tests for logger.ts: pino logger instance, child logger creation,
 * and extra property forwarding.
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import type { Logger } from '@/lib/logger';

const originalNodeEnv = process.env.NODE_ENV;
const originalLogLevel = process.env.LOG_LEVEL;

async function importLogger(nodeEnv = 'test', logLevel?: string) {
  vi.resetModules();
  (process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv;
  if (logLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = logLevel;
  }
  return import('@/lib/logger');
}

afterEach(() => {
  vi.resetModules();
  (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  if (originalLogLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLogLevel;
  }
});

describe('logger', () => {
  it('is a pino logger instance with standard log methods', async () => {
    const { logger } = await importLogger();

    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.fatal).toBe('function');
    expect(typeof logger.trace).toBe('function');
  });

  it('has a valid log level set', async () => {
    const { logger } = await importLogger();

    const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
    expect(validLevels).toContain(logger.level);
  });

  it('uses production defaults without pretty transport', async () => {
    const { logger } = await importLogger('production');

    expect(logger.level).toBe('info');
  });

  it('honors LOG_LEVEL over environment defaults', async () => {
    const { logger } = await importLogger('production', 'warn');

    expect(logger.level).toBe('warn');
  });

  it('supports child logger creation via logger.child()', async () => {
    const { logger } = await importLogger();
    const child = logger.child({ component: 'test' });

    expect(typeof child.info).toBe('function');
    expect(typeof child.error).toBe('function');
  });
});

describe('createRequestLogger', () => {
  it('returns a child logger with requestId bound', async () => {
    const { createRequestLogger } = await importLogger();
    const reqLogger = createRequestLogger('req-123');

    // The returned logger should have standard log methods
    expect(typeof reqLogger.info).toBe('function');
    expect(typeof reqLogger.warn).toBe('function');
    expect(typeof reqLogger.error).toBe('function');
    expect(typeof reqLogger.debug).toBe('function');

    // pino child loggers expose their bindings
    const bindings = reqLogger.bindings();
    expect(bindings.requestId).toBe('req-123');
  });

  it('includes extra properties in the child logger bindings', async () => {
    const { createRequestLogger } = await importLogger();
    const reqLogger = createRequestLogger('req-456', {
      userId: 'user-789',
      method: 'GET',
    });

    const bindings = reqLogger.bindings();
    expect(bindings.requestId).toBe('req-456');
    expect(bindings.userId).toBe('user-789');
    expect(bindings.method).toBe('GET');
  });

  it('returns a Logger-compatible type', async () => {
    const { createRequestLogger } = await importLogger();
    const reqLogger: Logger = createRequestLogger('req-type-check');

    // If this compiles and runs, the type is compatible
    expect(reqLogger).toBeDefined();
    expect(typeof reqLogger.info).toBe('function');
  });
});
