/**
 * FlowOps - Egress Guard (ガバナンス・ハーネス §4.2 を呼び出し境界へ適用)
 *
 * ハーネス出力を出口ゲートで検査し、結果を監査(EGRESS_GATE)へ残す。
 *  - block → EgressBlockedError（適用/永続化を止める）
 *  - flag  → 通すが thick で監査（要レビュー）
 *  - pass  → thin で監査
 *
 * 実体（生の出力文字列）はログに載せない。ruleId・category・count・field 経路のみ。
 */

import { auditLog, hashPolicy, AuditEntityType } from '../audit';
import { scanEgress } from './scanner';
import { EGRESS_RULES } from './rules';
import { EgressEvaluation, EgressFinding, EgressTier } from './types';

export class EgressBlockedError extends Error {
  readonly tier: EgressTier;
  readonly findings: EgressFinding[];

  constructor(tier: EgressTier, findings: EgressFinding[]) {
    const ids = findings
      .filter(f => f.severity === 'high')
      .map(f => `${f.ruleId}@${f.field}`)
      .join(', ');
    super(`Egress gate blocked output: ${ids}`);
    this.name = 'EgressBlockedError';
    this.tier = tier;
    this.findings = findings;
  }
}

export interface GuardEgressOptions {
  entityId?: string;
  entityType?: AuditEntityType;
  actor?: string;
}

// ルールセットの指紋（POL-2 相当）。ルール改変を監査で追跡可能にする。
const RULESET_VERSION = '1.0.0';

/**
 * ハーネス出力を検査する。block なら監査後に EgressBlockedError を送出する。
 */
export async function guardEgress(
  output: unknown,
  options: GuardEgressOptions = {}
): Promise<EgressEvaluation> {
  const evaluation = scanEgress(output);

  await auditLog.record({
    action: 'EGRESS_GATE',
    entityType: options.entityType ?? 'Proposal',
    entityId: options.entityId ?? 'egress',
    actor: options.actor,
    severity: evaluation.tier,
    policyVersion: RULESET_VERSION,
    policyHash: hashPolicy(EGRESS_RULES) ?? undefined,
    payload: {
      decision: evaluation.decision,
      findings: summarize(evaluation.findings),
    },
  });

  if (evaluation.decision === 'block') {
    throw new EgressBlockedError(evaluation.tier, evaluation.findings);
  }

  return evaluation;
}

/** 監査payload向けに finding を畳む（実体なし: ruleId/category/field/count のみ） */
function summarize(
  findings: EgressFinding[]
): Array<{ ruleId: string; category: string; severity: string; field: string; count: number }> {
  return findings.map(f => ({
    ruleId: f.ruleId,
    category: f.category,
    severity: f.severity,
    field: f.field,
    count: f.count,
  }));
}
