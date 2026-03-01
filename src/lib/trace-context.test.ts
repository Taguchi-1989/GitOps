/**
 * FlowOps - Trace Context Tests
 */

import { describe, it, expect } from 'vitest';
import { runWithTraceId, runWithNewTraceId, getTraceId, generateTraceId } from './trace-context';

describe('Trace Context', () => {
  describe('getTraceId', () => {
    it('should return undefined outside of context', () => {
      expect(getTraceId()).toBeUndefined();
    });
  });

  describe('runWithTraceId', () => {
    it('should make trace ID available within context', () => {
      const traceId = 'test-trace-123';
      let captured: string | undefined;

      runWithTraceId(traceId, () => {
        captured = getTraceId();
      });

      expect(captured).toBe('test-trace-123');
    });

    it('should not leak trace ID outside of context', () => {
      runWithTraceId('test-trace-456', () => {
        // inside context
      });

      expect(getTraceId()).toBeUndefined();
    });

    it('should return the function result', () => {
      const result = runWithTraceId('trace-1', () => 42);
      expect(result).toBe(42);
    });

    it('should support nested contexts', () => {
      let outer: string | undefined;
      let inner: string | undefined;
      let afterInner: string | undefined;

      runWithTraceId('outer-trace', () => {
        outer = getTraceId();

        runWithTraceId('inner-trace', () => {
          inner = getTraceId();
        });

        afterInner = getTraceId();
      });

      expect(outer).toBe('outer-trace');
      expect(inner).toBe('inner-trace');
      expect(afterInner).toBe('outer-trace');
    });
  });

  describe('runWithNewTraceId', () => {
    it('should generate a UUID v4 trace ID', () => {
      let captured: string | undefined;

      runWithNewTraceId(() => {
        captured = getTraceId();
      });

      expect(captured).toBeDefined();
      expect(captured).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('generateTraceId', () => {
    it('should return a UUID v4', () => {
      const traceId = generateTraceId();
      expect(traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));
      expect(ids.size).toBe(100);
    });
  });
});
