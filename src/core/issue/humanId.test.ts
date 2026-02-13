import { describe, it, expect } from 'vitest';
import { generateHumanId, parseHumanId, generateBranchName, titleToSlug } from './humanId';

describe('generateHumanId', () => {
  it('generates ISS-001 format', () => {
    expect(generateHumanId(1)).toBe('ISS-001');
  });

  it('pads to 3 digits by default', () => {
    expect(generateHumanId(42)).toBe('ISS-042');
    expect(generateHumanId(999)).toBe('ISS-999');
  });

  it('handles numbers exceeding padding', () => {
    expect(generateHumanId(1234)).toBe('ISS-1234');
  });

  it('supports custom prefix', () => {
    expect(generateHumanId(1, 'BUG')).toBe('BUG-001');
  });
});

describe('parseHumanId', () => {
  it('parses valid human ID', () => {
    const result = parseHumanId('ISS-042');
    expect(result).toEqual({ prefix: 'ISS', sequence: 42 });
  });

  it('returns null for invalid format', () => {
    expect(parseHumanId('invalid')).toBeNull();
    expect(parseHumanId('123')).toBeNull();
    expect(parseHumanId('')).toBeNull();
  });
});

describe('generateBranchName', () => {
  it('generates cr/ prefixed branch name', () => {
    const name = generateBranchName('ISS-001', 'fix-login');
    expect(name).toBe('cr/ISS-001-fix-login');
  });

  it('sanitizes slug', () => {
    const name = generateBranchName('ISS-001', 'Fix Login Bug!');
    expect(name).toMatch(/^cr\/ISS-001-[a-z0-9-]+$/);
  });

  it('truncates long slugs', () => {
    const longSlug = 'a'.repeat(100);
    const name = generateBranchName('ISS-001', longSlug);
    expect(name.length).toBeLessThanOrEqual(42); // cr/ISS-001- (11) + 30 + 1
  });
});

describe('titleToSlug', () => {
  it('converts title to slug', () => {
    expect(titleToSlug('Fix Login Bug')).toBe('fix-login-bug');
  });

  it('removes special characters', () => {
    expect(titleToSlug('Hello! World?')).toBe('hello-world');
  });

  it('returns "update" for empty result', () => {
    // Japanese-only title → no alpha chars → falls back to "update"
    expect(titleToSlug('日本語タイトル')).toBe('update');
  });
});
