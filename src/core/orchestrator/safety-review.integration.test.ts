/**
 * FlowOps - Safety Review Acceptance Gate Integration Test
 *
 * 実際の spec/gates/safety-review-gate.yaml ・ spec/validation-rules/iso-12100-coverage-check.yaml
 * ・ spec/assumptions/safety-review-assumptions.yaml をロードし、決定論的ゲート評価を検証する。
 * （fs はモックしない = 本物のYAMLがスキーマに適合することも併せて担保する）
 */

import { describe, it, expect } from 'vitest';
import { loadGate } from './gate-loader';
import { loadRule } from './rule-loader';
import { loadAssumptionSet, resolveAssumptions } from './assumption-loader';
import { evaluateGate } from './gate-evaluator';
import { RuleDefinition } from './schemas/validation-rule';

async function loadGateRules(ruleRefs: string[]): Promise<RuleDefinition[]> {
  return Promise.all(ruleRefs.map(id => loadRule(id)));
}

function hazardsOutput(categories: string[]): Record<string, unknown> {
  return { hazards: categories.map((c, i) => ({ id: `H${i}`, category: c })) };
}

describe('safety-review gate (real spec files)', () => {
  it('loads the gate, its rules and assumptions without schema errors', async () => {
    const gate = await loadGate('safety-review-gate');
    expect(gate.appliesTo.taskId).toBe('hazard-identification');
    expect(gate.ruleRefs).toContain('iso-12100-coverage-check');

    const rules = await loadGateRules(gate.ruleRefs);
    expect(rules.length).toBeGreaterThan(0);

    const set = await loadAssumptionSet('safety-review-assumptions');
    expect(set.assumptions.length).toBeGreaterThan(0);
  });

  it('returns go when coverage is at or above the threshold (9/10 and 8/10)', async () => {
    const gate = await loadGate('safety-review-gate');
    const rules = await loadGateRules(gate.ruleRefs);
    const required = rules[0].ruleLogic.requiredCategories ?? [];
    expect(required.length).toBe(10);

    const nine = evaluateGate(gate, rules, hazardsOutput(required.slice(0, 9)), 't');
    expect(nine.outcome).toBe('go');

    const eight = evaluateGate(gate, rules, hazardsOutput(required.slice(0, 8)), 't');
    expect(eight.outcome).toBe('go');
  });

  it('returns revise when coverage is below the threshold (7/10, warning severity)', async () => {
    const gate = await loadGate('safety-review-gate');
    const rules = await loadGateRules(gate.ruleRefs);
    const required = rules[0].ruleLogic.requiredCategories ?? [];

    const seven = evaluateGate(gate, rules, hazardsOutput(required.slice(0, 7)), 't');
    expect(seven.outcome).toBe('revise');
    expect(seven.summary.failedRuleIds).toContain('iso-12100-coverage-check');
  });

  it('resolves gate assumptions into a flat, auditable snapshot', async () => {
    const gate = await loadGate('safety-review-gate');
    const resolved = await resolveAssumptions(gate.assumptionRefs ?? []);
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved[0]).toHaveProperty('statement');
    expect(resolved[0]).toHaveProperty('setVersion');
  });
});
