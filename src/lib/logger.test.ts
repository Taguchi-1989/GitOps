/**
 * FlowOps - Logger Tests
 *
 * Tests for logger.ts: pino logger instance, child logger creation,
 * and extra property forwarding.
 */

import { describe, it, expect } from 'vitest';
import { logger, createRequestLogger } from '@/lib/logger';
import type { Logger } from '@/lib/logger';

describe('logger', () => {
  it('is a pino logger instance with standard log methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.fatal).toBe('function');
    expect(typeof logger.trace).toBe('function');
  });

  it('has a valid log level set', () => {
    const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
    expect(validLevels).toContain(logger.level);
  });

  it('supports child logger creation via logger.child()', () => {
    const child = logger.child({ component: 'test' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.error).toBe('function');
  });
});

describe('createRequestLogger', () => {
  it('returns a child logger with requestId bound', () => {
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

  it('includes extra properties in the child logger bindings', () => {
    const reqLogger = createRequestLogger('req-456', {
      userId: 'user-789',
      method: 'GET',
    });

    const bindings = reqLogger.bindings();
    expect(bindings.requestId).toBe('req-456');
    expect(bindings.userId).toBe('user-789');
    expect(bindings.method).toBe('GET');
  });

  it('returns a Logger-compatible type', () => {
    const reqLogger: Logger = createRequestLogger('req-type-check');

    // If this compiles and runs, the type is compatible
    expect(reqLogger).toBeDefined();
    expect(typeof reqLogger.info).toBe('function');
  });
});
