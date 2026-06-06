/**
 * FlowOps - Acceptance Gate Evaluator
 *
 * バリデーション結果を集約し、Go/Revise/Hold/Stop/Watch を決定論的に判定する純関数。
 * LLM を使わない。最終的な承認/差し戻しは人が Decision Card で決める。
 */

import { GateDefinition, GateOutcome } from './schemas/gate';
import { RuleDefinition, RuleSeverity } from './schemas/validation-rule';
import { evaluateRules, ValidationResult } from './rule-evaluator';

export interface GateEvaluation {
  gateId: string;
  gateVersion: string;
  outcome: GateOutcome;
  results: ValidationResult[];
  summary: {
    go: boolean;
    worstSeverity: RuleSeverity | null;
    failedRuleIds: string[];
    passedCount: number;
    totalCount: number;
  };
  evaluatedAt: string;
}

const SEVERITY_ORDER: Record<RuleSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

function severityToOutcome(severity: RuleSeverity, gate: GateDefinition): GateOutcome {
  switch (severity) {
    case 'critical':
      return gate.policy.onCritical;
    case 'error':
      return gate.policy.onError;
    case 'warning':
    case 'info':
      return gate.policy.onWarning;
  }
}

/**
 * ゲートを評価する。
 *
 * @param now ISO文字列。省略時は実時刻（決定論的判定には影響しないメタデータ）。
 */
export function evaluateGate(
  gate: GateDefinition,
  rules: RuleDefinition[],
  taskOutput: Record<string, unknown>,
  now?: string
): GateEvaluation {
  const results = evaluateRules(rules, taskOutput);
  const failed = results.filter(r => !r.passed);

  let outcome: GateOutcome;
  let worstSeverity: RuleSeverity | null = null;

  if (results.length === 0) {
    outcome = gate.policy.noRulesMatched;
  } else if (failed.length === 0) {
    outcome = gate.policy.allPassed;
  } else {
    worstSeverity = failed.reduce<RuleSeverity>(
      (worst, r) => (SEVERITY_ORDER[r.severity] > SEVERITY_ORDER[worst] ? r.severity : worst),
      failed[0].severity
    );
    outcome = severityToOutcome(worstSeverity, gate);
  }

  return {
    gateId: gate.id,
    gateVersion: gate.version,
    outcome,
    results,
    summary: {
      go: outcome === 'go',
      worstSeverity,
      failedRuleIds: failed.map(r => r.ruleId),
      passedCount: results.length - failed.length,
      totalCount: results.length,
    },
    evaluatedAt: now ?? new Date().toISOString(),
  };
}
