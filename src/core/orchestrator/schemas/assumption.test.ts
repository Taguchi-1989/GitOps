import { describe, it, expect } from 'vitest';
import { AssumptionSetSchema } from './assumption';

const validSet = {
  id: 'safety-review-assumptions',
  version: '1.0.0',
  title: '安全レビューの前提',
  assumptions: [
    {
      id: 'min-coverage',
      statement: 'ハザード識別はISO 12100の10カテゴリの80%以上を検討する',
      source: 'ISO 12100:2010 附属書B',
      rationale: '主要危害源の見落とし防止',
    },
  ],
  metadata: { author: 'safety-team', description: '安全レビューの前提集合' },
};

describe('AssumptionSetSchema', () => {
  it('accepts a valid assumption set', () => {
    expect(AssumptionSetSchema.safeParse(validSet).success).toBe(true);
  });

  it('rejects an empty assumptions array', () => {
    expect(AssumptionSetSchema.safeParse({ ...validSet, assumptions: [] }).success).toBe(false);
  });

  it('requires a statement on each assumption', () => {
    expect(
      AssumptionSetSchema.safeParse({
        ...validSet,
        assumptions: [{ id: 'x' }],
      }).success
    ).toBe(false);
  });

  it('rejects a non-semver version', () => {
    expect(AssumptionSetSchema.safeParse({ ...validSet, version: '1' }).success).toBe(false);
  });
});
