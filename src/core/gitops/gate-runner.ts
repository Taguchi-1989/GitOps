/**
 * FlowOps - GitOps Gate Runner (第II部 §11 / GIT-1)
 *
 * 第I部の純粋スキャナ（scanIngress / scanEgress）を合成し、判定を git の文脈
 * （commit SHA / PR 番号）に紐づけて監査ログ（GITOPS_GATE）へ残す。
 *
 * 二重監査を避けるため guard 系（自前で監査する）ではなく純関数を使い、
 * GitOps ゲートとして「一つの git 紐付き判定」を記録する。
 */

import { auditLog } from '../audit';
import { scanIngress, loadIngressPolicy } from '../ingress';
import { scanEgress } from '../egress';
import { RiskGrade } from '../approval';
import { GovernanceGateInput, GovernanceGateResult, MergeAction, GateLeafSummary } from './types';

function tierForAction(action: MergeAction): 'thin' | 'thick' | 'full' {
  if (action === 'block') return 'full';
  if (action === 'escalate') return 'thick';
  return 'thin';
}

/**
 * GitOps ゲートを実行する。
 * - diffText があれば入口検査（機密混入）
 * - artifact があれば出口検査（既知危険）
 * - 判定: いずれか block → block / mask|flag|high等級 → escalate / それ以外 → allow
 * - 判定を commit SHA / PR 番号に紐づけ GITOPS_GATE として監査（GIT-1）
 */
export async function runGovernanceGate(input: GovernanceGateInput): Promise<GovernanceGateResult> {
  const reasons: string[] = [];
  const riskGrade: RiskGrade = input.riskGrade ?? 'medium';

  let ingress: GateLeafSummary | null = null;
  if (typeof input.diffText === 'string') {
    const policy = await loadIngressPolicy();
    const ev = scanIngress(input.diffText, policy);
    ingress = {
      decision: ev.decision,
      count: ev.detections.reduce((s, d) => s + d.count, 0),
      policyVersion: ev.policyVersion,
    };
    if (ev.decision === 'block') reasons.push('入口ゲート: 機密混入を検出（block）');
    else if (ev.decision === 'mask') reasons.push('入口ゲート: 結合型機密を検出（要確認）');
  }

  let egress: GateLeafSummary | null = null;
  if (input.artifact !== undefined) {
    const ev = scanEgress(input.artifact);
    egress = { decision: ev.decision, count: ev.findings.length, policyVersion: '1.0.0' };
    if (ev.decision === 'block') reasons.push('出口ゲート: 既知危険を検出（block）');
    else if (ev.decision === 'flag') reasons.push('出口ゲート: 要レビュー（flag）');
  }

  // 判定の集約（最も重い側へ）
  let action: MergeAction = 'allow';
  const isBlock = ingress?.decision === 'block' || egress?.decision === 'block';
  const isEscalate =
    ingress?.decision === 'mask' || egress?.decision === 'flag' || riskGrade === 'high';
  if (isBlock) action = 'block';
  else if (isEscalate) action = 'escalate';

  if (action === 'allow') reasons.push('検出なし（allow）');
  if (action === 'escalate' && riskGrade === 'high') reasons.push('リスク等級 high のため要承認');

  const result: GovernanceGateResult = {
    action,
    riskGrade,
    reasons,
    ingress,
    egress,
    git: input.git,
  };

  // GIT-1: 判定を commit SHA / PR 番号に紐づけて監査（実体は載せない）。
  // 監査の永続化は best-effort: DB 未整備の CI 等で書込みに失敗しても判定は返す
  // （ゲート判定と exit code が CI のマージ制御の本体。監査永続化はアプリ実行時に行う）。
  try {
    await auditLog.record({
      action: 'GITOPS_GATE',
      entityType: 'System',
      entityId: input.git.commitSha || 'unknown-sha',
      actor: input.git.actor ?? undefined,
      severity: tierForAction(action),
      policyVersion: ingress?.policyVersion ?? egress?.policyVersion ?? undefined,
      payload: {
        action,
        riskGrade,
        prNumber: input.git.prNumber,
        branch: input.git.branch,
        repo: input.git.repo,
        ingress,
        egress,
        reasons,
      },
    });
  } catch {
    // 監査書込み失敗は判定に影響させない（best-effort）
  }

  return result;
}
