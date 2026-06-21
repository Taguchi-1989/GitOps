/**
 * FlowOps - Approval Workflow Types (ガバナンス・ハーネス §5 承認ワークフロー)
 *
 * Phase 0（全件人手 + 前例蓄積）の型。
 * - 判断は人・記録は機械（§5.1.3）: 人は yes/no + 一言理由のみ。完全証跡は機械が展開。
 * - リスク等級別の決裁ライン（§5.1.2）。
 * - 前例（precedent）は append-only 監査ログに蓄積し、Phase 1 自動承認の素地とする
 *   （ただし Phase 0 では自動承認しない = §5.3）。
 */

// リスク等級（spec §3.3）。承認ラインと保護厳格度をこれに比例させる。
export type RiskGrade = 'low' | 'medium' | 'high';

// 決裁ライン（§5.1.2）: 全件を最高権限者に上げない。
export type ApprovalLine = 'team-lead' | 'manager' | 'executive';

// 前例レコード（監査ログから復元した、過去の人手決定）
export interface Precedent {
  /** 案件の決定論的シグネチャ（同型ケースの同一性判定キー） */
  signature: string;
  /** 当時のポリシー版（版が変われば前例は流用不可 = §5.1.1） */
  policyVersion: string | null;
  riskGrade: RiskGrade;
  approved: boolean;
  reason: string | null;
  decidedBy: string | null;
  decidedAt: Date;
}

// 前例記録の入力
export interface RecordPrecedentInput {
  signature: string;
  riskGrade: RiskGrade;
  policyVersion?: string;
  approved: boolean;
  reason?: string;
  decidedBy?: string;
  /** 紐づけ元（workflowId / proposalId 等）。監査の追跡用 */
  sourceEntityId?: string;
}
