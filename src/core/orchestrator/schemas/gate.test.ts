import { describe, it, expect } from 'vitest';
import { GateDefinitionSchema, GatePolicySchema } from './gate';

const validGate = {
  id: 'safety-review-gate',
  version: '1.0.0',
  title: '安全レビュー受入ゲート',
  appliesTo: { taskId: 'hazard-identification' },
  ruleRefs: ['iso-12100-coverage-check'],
  policy: {
    onCritical: 'stop',
    onError: 'hold',
    onWarning: 'revise',
    allPassed: 'go',
    noRulesMatched: 'watch',
  },
  metadata: { author: 'safety-team', description: '安全レビューの受入ゲート' },
};

describe('GatePolicySchema', () => {
  it('applies defaults when policy fields are omitted', () => {
    const policy = GatePolicySchema.parse({});
    expect(policy).toEqual({
      onCritical: 'stop',
      onError: 'hold',
      onWarning: 'revise',
      allPassed: 'go',
      noRulesMatched: 'watch',
    });
  });

  it('rejects an invalid outcome', () => {
    expect(GatePolicySchema.safeParse({ onError: 'explode' }).success).toBe(false);
  });
});

describe('GateDefinitionSchema', () => {
  it('accepts a valid gate', () => {
    expect(GateDefinitionSchema.safeParse(validGate).success).toBe(true);
  });

  it('defaults ruleRefs to an empty array', () => {
    const { ruleRefs, ...rest } = validGate;
    void ruleRefs;
    const parsed = GateDefinitionSchema.parse(rest);
    expect(parsed.ruleRefs).toEqual([]);
  });

  it('rejects a non-semver version', () => {
    expect(GateDefinitionSchema.safeParse({ ...validGate, version: 'v1' }).success).toBe(false);
  });

  it('requires appliesTo.taskId', () => {
    expect(GateDefinitionSchema.safeParse({ ...validGate, appliesTo: {} }).success).toBe(false);
  });
});
