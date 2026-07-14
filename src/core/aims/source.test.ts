import { describe, expect, it } from 'vitest';
import { AimsSourceTooLargeError, chunkAimsSource, normalizeAimsSource } from './source';

describe('normalizeAimsSource', () => {
  it('normalizes line endings and surrounding whitespace', () => {
    expect(normalizeAimsSource(' first\r\nsecond\r')).toBe('first\nsecond');
  });
});

describe('chunkAimsSource', () => {
  it('adds stable source line references', () => {
    const chunks = chunkAimsSource('first\nsecond\nthird', { maxChars: 25, maxChunks: 10 });
    expect(chunks[0].text).toContain('[L1] first');
    expect(chunks.at(-1)).toMatchObject({ endLine: 3 });
  });

  it('splits a single long line without losing its line identity', () => {
    const chunks = chunkAimsSource('x'.repeat(80), { maxChars: 30, maxChunks: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.startLine === 1 && chunk.endLine === 1)).toBe(true);
    expect(chunks[0].text).toContain('[L1 part 1]');
  });

  it('fails before sending an unexpectedly large review', () => {
    expect(() => chunkAimsSource('one\ntwo\nthree\nfour', { maxChars: 10, maxChunks: 2 })).toThrow(
      AimsSourceTooLargeError
    );
  });
});
