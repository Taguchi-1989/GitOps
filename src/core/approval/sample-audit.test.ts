/**
 * FlowOps - Sample Audit Tests (§5.2 ゴム印化防止)
 */

import { describe, it, expect } from 'vitest';
import { sampleHash, shouldSampleAudit } from './sample-audit';

describe('sampleHash', () => {
  it('[0,1) の範囲・決定論（同キー同値）', () => {
    const h = sampleHash('event-1');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
    expect(sampleHash('event-1')).toBe(h);
  });

  it('異なるキーは（概ね）異なる値', () => {
    expect(sampleHash('a')).not.toBe(sampleHash('b'));
  });
});

describe('shouldSampleAudit', () => {
  it('rate=0 は常に false、rate=1 は常に true', () => {
    expect(shouldSampleAudit('x', 0)).toBe(false);
    expect(shouldSampleAudit('x', 1)).toBe(true);
  });

  it('決定論（同キー・同rateは同結果）', () => {
    expect(shouldSampleAudit('k', 0.5)).toBe(shouldSampleAudit('k', 0.5));
  });

  it('大量キーで概ね rate に近い割合が選ばれる（±5%）', () => {
    const N = 2000;
    const rate = 0.1;
    let hit = 0;
    for (let i = 0; i < N; i++) {
      if (shouldSampleAudit(`evt-${i}`, rate)) hit += 1;
    }
    const observed = hit / N;
    expect(Math.abs(observed - rate)).toBeLessThan(0.05);
  });
});
