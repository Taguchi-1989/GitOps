/**
 * FlowOps - Audit Log Types
 *
 * 監査ログ関連の型定義
 */

import { z } from 'zod';

// --------------------------------------------------------
// Audit Actions
// --------------------------------------------------------
export const AuditActionSchema = z.enum([
  // Issue lifecycle
  'ISSUE_CREATE',
  'ISSUE_UPDATE',
  'ISSUE_START',
  'ISSUE_CLOSE',
  'ISSUE_DELETE',
  'ISSUE_STANDARDIZE',

  // Proposal lifecycle
  'PROPOSAL_GENERATE',
  'PATCH_APPLY',

  // Git operations
  'MERGE_CLOSE',
  'DUPLICATE_MERGE',
  'GIT_COMMIT',
  'GIT_BRANCH_CREATE',
  'GIT_BRANCH_DELETE',

  // Workflow lifecycle
  'WORKFLOW_START',
  'WORKFLOW_COMPLETE',
  'WORKFLOW_FAIL',
  'WORKFLOW_CANCEL',
  'TASK_EXECUTE',
  'GATE_EVALUATE',
  'INGRESS_GATE', // ガバナンス・ハーネス §4.1: 入口ゲート（機密混入検査）判定
  'EGRESS_GATE', // ガバナンス・ハーネス §4.2: 出口ゲート（出力検査）判定
  'GITOPS_GATE', // ガバナンス・ハーネス §11 GIT-1: GitOps結合ゲート判定（commit SHA/PR紐付け）
  'HUMAN_APPROVE',
  'HUMAN_REJECT',
  'PRECEDENT_RECORD', // ガバナンス・ハーネス §5.1/§5.3: 人手承認の前例蓄積（Phase 0）
  'AUTO_APPROVE', // ガバナンス・ハーネス §5.1.1/§5.3: 前例に基づく自動承認（Phase 2）

  // Flow lifecycle
  'FLOW_CREATE',
  'FLOW_UPDATE',
  'FLOW_IMPORT',

  // System operations
  'BACKUP_CREATE',

  // GPTsiteki Section 8.6: データガバナンス監査アクション
  'DATA_ACCESS', // データオブジェクトへのアクセス
  'DATA_EXPORT', // データの外部持出/エクスポート
  'ABSTRACTION_APPLIED', // 抽象化処理の適用
  'PROVENANCE_RECORDED', // 来歴情報の記録
  'ACCESS_POLICY_CHANGE', // アクセスポリシーの変更
]);

export type AuditAction = z.infer<typeof AuditActionSchema>;

// --------------------------------------------------------
// Entity Types
// --------------------------------------------------------
export const AuditEntityTypeSchema = z.enum([
  'Issue',
  'Proposal',
  'Flow',
  'Evidence',
  'System',
  'WorkflowExecution',

  // GPTsiteki Section 8.6
  'DataObject',
]);

export type AuditEntityType = z.infer<typeof AuditEntityTypeSchema>;

// --------------------------------------------------------
// Audit Severity Tier (ガバナンス・ハーネス §6.2 階層化監査)
// --------------------------------------------------------
// thin  : 通過（安全側で素通り）。最小記録・時間減衰で日次サマリへ畳む対象
// thick : 例外（人へエスカレーション）。判断文脈を保持・長期
// full  : インシデント（ポリシー違反検出）。再現可能な完全証跡・最長期
export const AuditTierSchema = z.enum(['thin', 'thick', 'full']);
export type AuditTier = z.infer<typeof AuditTierSchema>;

// --------------------------------------------------------
// Audit Log Entry
// --------------------------------------------------------
export interface AuditLogEntry {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  traceId?: string;
  payload?: Record<string, unknown>;
  actor?: string;

  // ガバナンス・ハーネス POL-2/LOG-4: 判定時のポリシー版とその内容ハッシュ
  policyVersion?: string;
  policyHash?: string;

  // ガバナンス・ハーネス §6.2: 重大度層（既定は thin）
  severity?: AuditTier;
}

// --------------------------------------------------------
// Audit Query Options
// --------------------------------------------------------
export interface AuditQueryOptions {
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  actor?: string;
  traceId?: string;
  // ガバナンス・ハーネス: コンテンツアドレス / ポリシー版での照会（重複排除・版追跡）
  contentHash?: string;
  policyVersion?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
