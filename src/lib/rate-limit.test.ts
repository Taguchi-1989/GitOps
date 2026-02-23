/**
 * FlowOps - Rate Limiter Tests
 *
 * Comprehensive test coverage for sliding window rate limiter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkRateLimit, RATE_LIMITS, _resetStore } from '@/lib/rate-limit';

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic allow/deny behavior', () => {
    it('should allow requests under the limit', () => {
      const config = { windowMs: 60_000, maxRequests: 3 };

      const result1 = checkRateLimit('test-key', config);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = checkRateLimit('test-key', config);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = checkRateLimit('test-key', config);
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it('should deny requests over the limit', () => {
      const config = { windowMs: 60_000, maxRequests: 2 };

      checkRateLimit('test-key', config);
      checkRateLimit('test-key', config);

      const result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return correct resetMs when rate limit is exceeded', () => {
      const config = { windowMs: 60_000, maxRequests: 2 };
      const startTime = 1000;
      vi.setSystemTime(startTime);

      checkRateLimit('test-key', config); // t=1000
      checkRateLimit('test-key', config); // t=1000

      vi.advanceTimersByTime(5000); // advance to t=6000
      const result = checkRateLimit('test-key', config);

      expect(result.allowed).toBe(false);
      // resetMs should be (1000 + 60000) - 6000 = 55000
      expect(result.resetMs).toBe(55_000);
    });

    it('should allow first request for new key', () => {
      const config = { windowMs: 60_000, maxRequests: 5 };

      const result = checkRateLimit('brand-new-key', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe('Window expiration (timestamps slide out)', () => {
    it('should allow new requests after window expires', () => {
      const config = { windowMs: 10_000, maxRequests: 2 };

      checkRateLimit('test-key', config);
      checkRateLimit('test-key', config);

      // Deny third request
      let result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(10_001);

      // Should allow requests again
      result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('should only remove timestamps outside the window', () => {
      const config = { windowMs: 10_000, maxRequests: 3 };

      vi.setSystemTime(1000);
      checkRateLimit('test-key', config); // t=1000

      vi.advanceTimersByTime(5000); // t=6000
      checkRateLimit('test-key', config); // t=6000
      checkRateLimit('test-key', config); // t=6000

      // All 3 slots used, should deny
      let result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(false);

      // Advance time to expire first timestamp (1000 + 10000 = 11000)
      vi.advanceTimersByTime(5001); // t=11001

      // First timestamp should be expired, allowing 1 more request
      result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // 2 from t=6000 + 1 from t=11001
    });

    it('should handle gradual timestamp expiration', () => {
      const config = { windowMs: 1000, maxRequests: 2 };

      vi.setSystemTime(0);
      checkRateLimit('test-key', config); // t=0

      vi.advanceTimersByTime(500);
      checkRateLimit('test-key', config); // t=500

      // Limit reached
      let result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(false);

      // After 501ms, first timestamp expires
      vi.advanceTimersByTime(501); // t=1001
      result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // t=500 still in window, t=1001 added

      // After another 500ms, second timestamp expires
      vi.advanceTimersByTime(500); // t=1501
      result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // t=1001 still in window, t=1501 added
    });
  });

  describe('Different rate limit presets', () => {
    it('should enforce api preset (60req/min)', () => {
      const key = 'api-test';

      // Make 60 requests
      for (let i = 0; i < 60; i++) {
        const result = checkRateLimit(key, RATE_LIMITS.api);
        expect(result.allowed).toBe(true);
      }

      // 61st request should be denied
      const result = checkRateLimit(key, RATE_LIMITS.api);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should enforce llm preset (10req/min)', () => {
      const key = 'llm-test';

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit(key, RATE_LIMITS.llm);
        expect(result.allowed).toBe(true);
      }

      // 11th request should be denied
      const result = checkRateLimit(key, RATE_LIMITS.llm);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should enforce auth preset (10req/min)', () => {
      const key = 'auth-test';

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit(key, RATE_LIMITS.auth);
        expect(result.allowed).toBe(true);
      }

      // 11th request should be denied
      const result = checkRateLimit(key, RATE_LIMITS.auth);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should have consistent window size for presets', () => {
      expect(RATE_LIMITS.api.windowMs).toBe(60_000);
      expect(RATE_LIMITS.llm.windowMs).toBe(60_000);
      expect(RATE_LIMITS.auth.windowMs).toBe(60_000);
    });
  });

  describe('Remaining count decrements correctly', () => {
    it('should decrement remaining count with each request', () => {
      const config = { windowMs: 60_000, maxRequests: 5 };

      let result = checkRateLimit('test-key', config);
      expect(result.remaining).toBe(4);

      result = checkRateLimit('test-key', config);
      expect(result.remaining).toBe(3);

      result = checkRateLimit('test-key', config);
      expect(result.remaining).toBe(2);

      result = checkRateLimit('test-key', config);
      expect(result.remaining).toBe(1);

      result = checkRateLimit('test-key', config);
      expect(result.remaining).toBe(0);
    });

    it('should maintain remaining at 0 when limit exceeded', () => {
      const config = { windowMs: 60_000, maxRequests: 2 };

      checkRateLimit('test-key', config);
      checkRateLimit('test-key', config);

      let result = checkRateLimit('test-key', config);
      expect(result.remaining).toBe(0);

      result = checkRateLimit('test-key', config);
      expect(result.remaining).toBe(0);

      result = checkRateLimit('test-key', config);
      expect(result.remaining).toBe(0);
    });

    it('should reset remaining count after window expires', () => {
      const config = { windowMs: 5_000, maxRequests: 3 };

      checkRateLimit('test-key', config);
      checkRateLimit('test-key', config);

      let result = checkRateLimit('test-key', config);
      expect(result.remaining).toBe(0);

      // Advance past window
      vi.advanceTimersByTime(5_001);

      result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2); // Back to max - 1
    });

    it('should increase remaining as old timestamps expire', () => {
      const config = { windowMs: 10_000, maxRequests: 3 };

      vi.setSystemTime(0);
      checkRateLimit('test-key', config); // t=0

      vi.advanceTimersByTime(1000);
      checkRateLimit('test-key', config); // t=1000

      vi.advanceTimersByTime(1000);
      checkRateLimit('test-key', config); // t=2000

      // All slots used, remaining should be 0
      let result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);

      // Expire first timestamp (t=0)
      vi.advanceTimersByTime(8_001); // t=10001
      result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // t=1000, t=2000, t=10001

      // Expire second timestamp (t=1000)
      vi.advanceTimersByTime(1000); // t=11001
      result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // t=2000, t=10001, t=11001
    });
  });

  describe('Multiple independent keys', () => {
    it('should track different keys independently', () => {
      const config = { windowMs: 60_000, maxRequests: 2 };

      const result1 = checkRateLimit('key-1', config);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(1);

      const result2 = checkRateLimit('key-2', config);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = checkRateLimit('key-1', config);
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);

      const result4 = checkRateLimit('key-2', config);
      expect(result4.allowed).toBe(true);
      expect(result4.remaining).toBe(0);
    });

    it('should not affect other keys when one is rate limited', () => {
      const config = { windowMs: 60_000, maxRequests: 1 };

      checkRateLimit('limited-key', config);

      const result1 = checkRateLimit('limited-key', config);
      expect(result1.allowed).toBe(false);

      const result2 = checkRateLimit('other-key', config);
      expect(result2.allowed).toBe(true);
    });

    it('should handle many concurrent keys', () => {
      const config = { windowMs: 60_000, maxRequests: 3 };
      const keys = Array.from({ length: 100 }, (_, i) => `key-${i}`);

      for (const key of keys) {
        const result = checkRateLimit(key, config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
      }

      // Second request for each key
      for (const key of keys) {
        const result = checkRateLimit(key, config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);
      }
    });

    it('should expire timestamps independently per key', () => {
      const config = { windowMs: 5_000, maxRequests: 1 };

      vi.setSystemTime(0);
      checkRateLimit('key-1', config); // t=0

      vi.advanceTimersByTime(3000); // t=3000
      checkRateLimit('key-2', config); // t=3000

      // Both keys at limit
      let result1 = checkRateLimit('key-1', config);
      expect(result1.allowed).toBe(false);

      let result2 = checkRateLimit('key-2', config);
      expect(result2.allowed).toBe(false);

      // Advance to expire key-1 (0 + 5000 = 5000)
      vi.advanceTimersByTime(2_001); // t=5001

      result1 = checkRateLimit('key-1', config);
      expect(result1.allowed).toBe(true); // Expired

      result2 = checkRateLimit('key-2', config);
      expect(result2.allowed).toBe(false); // Still in window (3000 + 5000 = 8000)

      // Advance to expire key-2
      vi.advanceTimersByTime(3000); // t=8001

      result2 = checkRateLimit('key-2', config);
      expect(result2.allowed).toBe(true); // Now expired
    });

    it('should handle same key with different configs', () => {
      const strictConfig = { windowMs: 60_000, maxRequests: 1 };
      const lenientConfig = { windowMs: 60_000, maxRequests: 10 };

      // Use strict config first
      checkRateLimit('test-key', strictConfig);
      let result = checkRateLimit('test-key', strictConfig);
      expect(result.allowed).toBe(false);

      // Switch to lenient config - should see existing timestamp
      result = checkRateLimit('test-key', lenientConfig);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(8); // Already has 2 timestamps
    });
  });

  describe('Edge cases', () => {
    it('should handle zero window correctly', () => {
      const config = { windowMs: 0, maxRequests: 5 };

      const result1 = checkRateLimit('test-key', config);
      expect(result1.allowed).toBe(true);

      // All previous timestamps immediately outside window
      const result2 = checkRateLimit('test-key', config);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(4); // Effectively no history
    });

    it('should handle maxRequests of 1', () => {
      const config = { windowMs: 60_000, maxRequests: 1 };

      const result1 = checkRateLimit('test-key', config);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(0);

      const result2 = checkRateLimit('test-key', config);
      expect(result2.allowed).toBe(false);
      expect(result2.remaining).toBe(0);
    });

    it('should handle very large maxRequests', () => {
      const config = { windowMs: 60_000, maxRequests: 10_000 };

      for (let i = 0; i < 1000; i++) {
        const result = checkRateLimit('test-key', config);
        expect(result.allowed).toBe(true);
      }

      // 1001回目もallowed。remaining = 10000 - 1001 = 8999
      const result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(8_999);
    });

    it('should return correct resetMs on first request', () => {
      const config = { windowMs: 30_000, maxRequests: 5 };

      const result = checkRateLimit('new-key', config);
      expect(result.resetMs).toBe(30_000);
    });

    it('should handle rapid successive requests', () => {
      const config = { windowMs: 60_000, maxRequests: 100 };

      vi.setSystemTime(1000);

      // Make 100 requests at exact same timestamp
      for (let i = 0; i < 100; i++) {
        const result = checkRateLimit('test-key', config);
        expect(result.allowed).toBe(true);
      }

      const result = checkRateLimit('test-key', config);
      expect(result.allowed).toBe(false);
    });
  });
});
