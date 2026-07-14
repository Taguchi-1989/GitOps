import { describe, expect, it } from 'vitest';
import {
  evaluateConditionExpression,
  isSupportedConditionExpression,
} from './condition-expression';

describe('condition expressions', () => {
  it('supports equality, inequality, truthy, and numeric comparisons', () => {
    const state = { status: 'ready', blocked: false, stock: 4 };

    expect(evaluateConditionExpression('status == "ready"', state)).toBe(true);
    expect(evaluateConditionExpression('status != blocked', state)).toBe(true);
    expect(evaluateConditionExpression('blocked', state)).toBe(false);
    expect(evaluateConditionExpression('stock >= 4', state)).toBe(true);
    expect(evaluateConditionExpression('stock < 4', state)).toBe(false);
  });

  it('rejects unsupported compound expressions', () => {
    expect(isSupportedConditionExpression('stock > 0 && status == "ready"')).toBe(false);
    expect(evaluateConditionExpression('stock > 0 && status == "ready"', { stock: 4 })).toBe(false);
  });
});
