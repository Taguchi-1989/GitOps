import { describe, it, expect } from 'vitest';
import { sha256, hashObject, shortHash, hashMatch } from './hash';

describe('sha256', () => {
  it('returns consistent hash for same input', () => {
    const hash1 = sha256('hello');
    const hash2 = sha256('hello');
    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different input', () => {
    expect(sha256('hello')).not.toBe(sha256('world'));
  });

  it('returns 64-character hex string', () => {
    const hash = sha256('test');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('hashObject', () => {
  it('hashes an object consistently', () => {
    const obj = { a: 1, b: 'test' };
    expect(hashObject(obj)).toBe(hashObject({ a: 1, b: 'test' }));
  });
});

describe('shortHash', () => {
  it('returns first 8 characters by default', () => {
    const hash = sha256('test');
    expect(shortHash(hash)).toBe(hash.substring(0, 8));
    expect(shortHash(hash)).toHaveLength(8);
  });

  it('respects custom length', () => {
    const hash = sha256('test');
    expect(shortHash(hash, 12)).toHaveLength(12);
  });
});

describe('hashMatch', () => {
  it('returns true for matching hashes', () => {
    const hash = sha256('test');
    expect(hashMatch(hash, hash)).toBe(true);
  });

  it('returns false for different hashes', () => {
    expect(hashMatch(sha256('a'), sha256('b'))).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(hashMatch('abc', 'abcd')).toBe(false);
  });
});
