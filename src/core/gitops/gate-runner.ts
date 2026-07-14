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

/**
 * Keep each scanner invocation below its per-value fail-safe limit. Splitting is
 * line-aware so credentials and commands that normally live on one diff line
 * are never cut across chunks. A single oversized line is intentionally kept
 * intact and is therefore still blocked by the underlying scanner.
 */
const GITOPS_SCAN_CHUNK_SIZE = 80_000;

function scannerChunks(text: string): string[] {
  if (text.length <= GITOPS_SCAN_CHUNK_SIZE) return [text];

  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [''];
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    if (line.length > GITOPS_SCAN_CHUNK_SIZE) {
      if (current) chunks.push(current);
      chunks.push(line);
      current = '';
      continue;
    }

    if (current.length + line.length > GITOPS_SCAN_CHUNK_SIZE) {
      chunks.push(current);
      current = line;
    } else {
      current += line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

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
    const policy = await loadIngressPolicy(input.ingressPolicyId);
    const evaluations = scannerChunks(input.diffText).map(chunk => scanIngress(chunk, policy));
    const decision = evaluations.some(ev => ev.decision === 'block')
      ? 'block'
      : evaluations.some(ev => ev.decision === 'mask')
        ? 'mask'
        : 'pass';
    ingress = {
      decision,
      count: evaluations.reduce(
        (total, ev) => total + ev.detections.reduce((sum, detection) => sum + detection.count, 0),
        0
      ),
      policyVersion: evaluations[0]?.policyVersion ?? policy.version,
    };
    if (decision === 'block') reasons.push('入口ゲート: 機密混入を検出（block）');
    else if (decision === 'mask') reasons.push('入口ゲート: 結合型機密を検出（要確認）');
  }

  let egress: GateLeafSummary | null = null;
  if (input.artifact !== undefined) {
    const artifacts =
      typeof input.artifact === 'string' ? scannerChunks(input.artifact) : [input.artifact];
    const evaluations = artifacts.map(artifact => scanEgress(artifact));
    const decision = evaluations.some(ev => ev.decision === 'block')
      ? 'block'
      : evaluations.some(ev => ev.decision === 'flag')
        ? 'flag'
        : 'pass';
    egress = {
      decision,
      count: evaluations.reduce((total, ev) => total + ev.findings.length, 0),
      policyVersion: '1.0.0',
    };
    if (decision === 'block') reasons.push('出口ゲート: 既知危険を検出（block）');
    else if (decision === 'flag') reasons.push('出口ゲート: 要レビュー（flag）');
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
