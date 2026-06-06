/**
 * FlowOps - Acceptance Gate Evaluator Tests
 *
 * Go / Revise / Hold / Stop / Watch の5値出し分けを網羅する。
 */

import { describe, it, expect } from 'vitest';
import { evaluateGate } from './gate-evaluator';
import { GateDefinition } from './schemas/gate';
import { RuleDefinition, RuleSeverity } from './schemas/validation-rule';

function gate(): GateDefinition {
  return {
    id: 'safety-review-gate',
    version: '1.0.0',
    title: 'gate',
    appliesTo: { taskId: 'hazard-identification' },
    ruleRefs: [],
    policy: {
      onCritical: 'stop',
      onError: 'hold',
      onWarning: 'revise',
      allPassed: 'go',
      noRulesMatched: 'watch',
    },
    metadata: { author: 'safety-team', description: 'gate' },
  };
}

function rule(id: string, severity: RuleSeverity): RuleDefinition {
  return {
    id,
    version: '1.0.0',
    title: id,
    ruleType: 'completeness',
    severity,
    appliesTo: { taskId: 'hazard-identification', outputField: 'hazards' },
    ruleLogic: {
      field: 'hazards[].category',
      requiredCategories: ['a', 'b'],
      minimumCoverage: 1,
    },
    metadata: { author: 's', description: 'd' },
  };
}

const PASS = { hazards: [{ category: 'a' }, { category: 'b' }] };
const FAIL = { hazards: [{ category: 'a' }] }; // coverage 0.5 < 1

describe('evaluateGate outcomes', () => {
  it('go: all rules pass', () => {
    const evaluation = evaluateGate(gate(), [rule('r', 'warning')], PASS, 't');
    expect(evaluation.outcome).toBe('go');
    expect(evaluation.summary.go).toBe(true);
    expect(evaluation.summary.passedCount).toBe(1);
  });

  it('revise: a warning rule fails', () => {
    const evaluation = evaluateGate(gate(), [rule('r', 'warning')], FAIL, 't');
    expect(evaluation.outcome).toBe('revise');
    expect(evaluation.summary.failedRuleIds).toEqual(['r']);
  });

  it('hold: an error rule fails', () => {
    const evaluation = evaluateGate(gate(), [rule('r', 'error')], FAIL, 't');
    expect(evaluation.outcome).toBe('hold');
  });

  it('stop: a critical rule fails', () => {
    const evaluation = evaluateGate(gate(), [rule('r', 'critical')], FAIL, 't');
    expect(evaluation.outcome).toBe('stop');
  });

  it('watch: no rules apply', () => {
    const evaluation = evaluateGate(gate(), [], PASS, 't');
    expect(evaluation.outcome).toBe('watch');
    expect(evaluation.summary.totalCount).toBe(0);
  });
});

describe('evaluateGate severity aggregation', () => {
  it('uses the worst failing severity to decide the outcome', () => {
    const evaluation = evaluateGate(
      gate(),
      [rule('r1', 'warning'), rule('r2', 'critical')],
      FAIL,
      't'
    );
    expect(evaluation.summary.worstSeverity).toBe('critical');
    expect(evaluation.outcome).toBe('stop');
    expect(evaluation.summary.failedRuleIds).toEqual(['r1', 'r2']);
  });

  it('records the evaluation timestamp passed in', () => {
    const evaluation = evaluateGate(gate(), [rule('r', 'warning')], PASS, '2026-06-06T00:00:00Z');
    expect(evaluation.evaluatedAt).toBe('2026-06-06T00:00:00Z');
  });
});
