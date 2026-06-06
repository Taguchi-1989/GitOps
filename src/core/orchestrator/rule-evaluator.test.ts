/**
 * FlowOps - Validation Rule Evaluator Tests
 */

import { describe, it, expect } from 'vitest';
import { resolvePath, evaluateRule, evaluateRules } from './rule-evaluator';
import { RuleDefinition } from './schemas/validation-rule';

const ISO_CATEGORIES = [
  'mechanical',
  'electrical',
  'thermal',
  'noise',
  'vibration',
  'radiation',
  'materials',
  'ergonomic',
  'slip-trip-fall',
  'combination',
];

function completenessRule(min: number, categories = ISO_CATEGORIES): RuleDefinition {
  return {
    id: 'iso-12100-coverage-check',
    version: '1.0.0',
    title: 'coverage',
    ruleType: 'completeness',
    severity: 'warning',
    appliesTo: { taskId: 'hazard-identification', outputField: 'hazards' },
    ruleLogic: {
      field: 'hazards[].category',
      requiredCategories: categories,
      minimumCoverage: min,
    },
    metadata: { author: 'system', description: 'coverage check' },
  };
}

function hazardsOutput(categories: Array<string | null>): Record<string, unknown> {
  return {
    hazards: categories.map((c, i) => (c === null ? null : { id: `H${i}`, category: c })),
  };
}

describe('resolvePath', () => {
  it('resolves nested array.field paths', () => {
    expect(resolvePath(hazardsOutput(['mechanical', 'electrical']), 'hazards[].category')).toEqual([
      'mechanical',
      'electrical',
    ]);
  });

  it('skips items missing the trailing key', () => {
    const output = { hazards: [{ id: 'H0' }, { id: 'H1', category: 'thermal' }] };
    expect(resolvePath(output, 'hazards[].category')).toEqual(['thermal']);
  });

  it('skips null array elements', () => {
    expect(resolvePath(hazardsOutput([null, 'noise']), 'hazards[].category')).toEqual(['noise']);
  });

  it('returns empty when the array key is not an array', () => {
    expect(resolvePath({ hazards: 'oops' }, 'hazards[].category')).toEqual([]);
  });

  it('resolves a direct primitive array with [] suffix', () => {
    expect(resolvePath({ tags: ['a', 'b'] }, 'tags[]')).toEqual(['a', 'b']);
  });

  it('returns empty for null root', () => {
    expect(resolvePath(null, 'hazards[].category')).toEqual([]);
  });
});

describe('evaluateRule (completeness)', () => {
  it('passes at the coverage boundary (8/10 with min 0.8)', () => {
    const result = evaluateRule(completenessRule(0.8), hazardsOutput(ISO_CATEGORIES.slice(0, 8)));
    expect(result.coverage).toBeCloseTo(0.8);
    expect(result.passed).toBe(true);
  });

  it('fails just below the boundary (7/10 with min 0.8)', () => {
    const result = evaluateRule(completenessRule(0.8), hazardsOutput(ISO_CATEGORIES.slice(0, 7)));
    expect(result.coverage).toBeCloseTo(0.7);
    expect(result.passed).toBe(false);
    expect(result.details.missing).toHaveLength(3);
  });

  it('matches categories case-insensitively but reports original casing', () => {
    const result = evaluateRule(completenessRule(1), hazardsOutput(['Mechanical', 'ELECTRICAL']));
    const rule2 = completenessRule(1, ['mechanical', 'electrical']);
    const r2 = evaluateRule(rule2, hazardsOutput(['Mechanical', 'ELECTRICAL']));
    expect(r2.passed).toBe(true);
    expect(r2.details.matched).toEqual(['mechanical', 'electrical']);
    void result;
  });

  it('passes (skipped) when requiredCategories is undefined', () => {
    const rule = completenessRule(0.8);
    delete (rule.ruleLogic as Record<string, unknown>).requiredCategories;
    const result = evaluateRule(rule, hazardsOutput(['mechanical']));
    expect(result.passed).toBe(true);
    expect(result.details.message).toContain('no requiredCategories');
  });
});

describe('evaluateRule (unimplemented ruleType)', () => {
  it('passes through unimplemented rule types', () => {
    const rule = { ...completenessRule(1), ruleType: 'compliance' as const };
    const result = evaluateRule(rule, {});
    expect(result.passed).toBe(true);
    expect(result.details.message).toContain('not implemented');
  });
});

describe('evaluateRules', () => {
  it('evaluates each rule in order', () => {
    const results = evaluateRules(
      [completenessRule(1), { ...completenessRule(1), id: 'second' }],
      hazardsOutput(ISO_CATEGORIES)
    );
    expect(results.map(r => r.ruleId)).toEqual(['iso-12100-coverage-check', 'second']);
    expect(results.every(r => r.passed)).toBe(true);
  });
});
