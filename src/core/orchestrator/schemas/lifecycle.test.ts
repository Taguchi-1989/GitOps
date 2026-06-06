import { describe, it, expect } from 'vitest';
import { LifecycleSchema, LifecycleStageSchema } from './lifecycle';

describe('LifecycleStageSchema', () => {
  it('accepts all defined stages', () => {
    for (const stage of ['draft', 'reviewed', 'approved', 'active', 'deprecated']) {
      expect(LifecycleStageSchema.safeParse(stage).success).toBe(true);
    }
  });

  it('rejects unknown stage', () => {
    expect(LifecycleStageSchema.safeParse('archived').success).toBe(false);
  });
});

describe('LifecycleSchema', () => {
  it('defaults stage to draft when omitted', () => {
    const result = LifecycleSchema.parse({});
    expect(result.stage).toBe('draft');
  });

  it('accepts a full lifecycle object', () => {
    const result = LifecycleSchema.parse({
      stage: 'active',
      reviewedBy: 'alice',
      approvedBy: 'bob',
      updatedAt: '2026-06-06T00:00:00Z',
    });
    expect(result.stage).toBe('active');
    expect(result.approvedBy).toBe('bob');
  });

  it('rejects an invalid stage', () => {
    expect(LifecycleSchema.safeParse({ stage: 'nope' }).success).toBe(false);
  });
});
