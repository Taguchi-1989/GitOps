/**
 * FlowOps - GitOps Binding Types (ガバナンス・ハーネス 第II部 §10-§12)
 *
 * 第I部コアを GitOps（GitHub Actions）へ結合するアダプタ層の型。
 *
 * GIT-4（移植性の不変条件）: 本アダプタは GitHub Actions SDK / Octokit に依存しない。
 * git の文脈は「ただのデータ（GitContext）」として受け取り、判定とログを返す純粋な境界に保つ。
 * 実際の GitHub API 呼び出し（issue 起票・コミットステータス）は CLI / workflow 側が担う。
 * これにより in-line / gateway いずれのモードでも同一アダプタが動作する（§2.1 / §10）。
 */

import { RiskGrade } from '../approval';

/** git の最小文脈（env から解析。コアはこれ以上の GitHub 知識を持たない） */
export interface GitContext {
  commitSha: string;
  prNumber: number | null;
  branch: string | null;
  /** owner/repo */
  repo: string | null;
  actor: string | null;
}

/** マージに対する判定 */
export type MergeAction = 'allow' | 'block' | 'escalate';

export interface GovernanceGateInput {
  git: GitContext;
  /** 入口検査の対象テキスト（例: PR 差分）。機密混入を検出 */
  diffText?: string;
  /** 出口検査の対象（例: 生成成果物）。既知危険を検出 */
  artifact?: unknown;
  /** リスク等級（未指定は medium 相当として escalate 寄せ） */
  riskGrade?: RiskGrade;
}

export interface GateLeafSummary {
  decision: string;
  /** 検出件数（実体は載せない） */
  count: number;
  policyVersion: string | null;
}

export interface GovernanceGateResult {
  action: MergeAction;
  riskGrade: RiskGrade;
  reasons: string[];
  ingress: GateLeafSummary | null;
  egress: GateLeafSummary | null;
  git: GitContext;
}
