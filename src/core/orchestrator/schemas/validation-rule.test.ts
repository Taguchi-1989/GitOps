import { describe, it, expect } from 'vitest';
import { RuleDefinitionSchema } from './validation-rule';

const validRule = {
  id: 'iso-12100-coverage-check',
  version: '1.0.0',
  title: 'ISO 12100 危害源カテゴリ網羅性チェック',
  description: 'ハザード識別結果が10カテゴリ全てを検討しているか確認する',
  ruleType: 'completeness',
  severity: 'warning',
  appliesTo: {
    taskId: 'hazard-identification',
    outputField: 'hazards',
  },
  ruleLogic: {
    field: 'hazards[].category',
    requiredCategories: ['mechanical', 'electrical'],
    minimumCoverage: 0.8,
  },
  metadata: {
    author: 'system',
    description: 'ISO 12100準拠の網羅性検証',
    tags: ['iso-12100'],
  },
};

describe('RuleDefinitionSchema', () => {
  it('accepts a valid rule mirroring the iso-12100 yaml', () => {
    expect(RuleDefinitionSchema.safeParse(validRule).success).toBe(true);
  });

  it('rejects a non-semver version', () => {
    expect(RuleDefinitionSchema.safeParse({ ...validRule, version: '1.0' }).success).toBe(false);
  });

  it('rejects an unknown ruleType', () => {
    expect(RuleDefinitionSchema.safeParse({ ...validRule, ruleType: 'magic' }).success).toBe(false);
  });

  it('rejects an unknown severity', () => {
    expect(RuleDefinitionSchema.safeParse({ ...validRule, severity: 'fatal' }).success).toBe(false);
  });

  it('requires appliesTo.taskId', () => {
    const { appliesTo, ...rest } = validRule;
    void appliesTo;
    expect(
      RuleDefinitionSchema.safeParse({ ...rest, appliesTo: { outputField: 'x' } }).success
    ).toBe(false);
  });

  it('keeps unknown ruleLogic keys via passthrough', () => {
    const parsed = RuleDefinitionSchema.parse({
      ...validRule,
      ruleLogic: { field: 'a', threshold: 42 },
    });
    expect((parsed.ruleLogic as Record<string, unknown>).threshold).toBe(42);
  });
});
