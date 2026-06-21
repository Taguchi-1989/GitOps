/**
 * FlowOps - Audit Logger
 *
 * 監査ログの記録と照会
 */

import { AuditLogEntry, AuditQueryOptions, AuditTier } from './types';
import { getTraceId } from '@/lib/trace-context';

// Note: 実際のPrismaクライアントはlibから注入される
// ここではインターフェースのみ定義

export interface AuditLogRecord {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  traceId: string | null;
  payload: unknown;
  // ガバナンス・ハーネス: コンテンツアドレス（LOG-1/2）・ポリシー版刻印（POL-2/LOG-4）・重大度層（§6.2）。
  // Prisma リポジトリは常にこれらを充足して返す（mapRecord 参照）。読み取り側の後方互換のため optional。
  contentHash?: string | null;
  policyVersion?: string | null;
  policyHash?: string | null;
  severity?: string;
  createdAt: Date;
}

export interface IAuditLogRepository {
  create(entry: AuditLogEntry): Promise<AuditLogRecord>;
  findMany(options: AuditQueryOptions): Promise<AuditLogRecord[]>;
  count(options: AuditQueryOptions): Promise<number>;
}

class AuditLogger {
  private repository: IAuditLogRepository | null = null;
  private defaultActor = 'you';
  private autoInitPromise: Promise<void> | null = null;

  /**
   * リポジトリを設定（Prismaクライアント注入用）
   */
  setRepository(repo: IAuditLogRepository): void {
    this.repository = repo;
  }

  /**
   * デフォルトアクターを設定
   */
  setDefaultActor(actor: string): void {
    this.defaultActor = actor;
  }

  /**
   * リポジトリが未設定の場合に自動初期化（フォールバック）
   * - instrumentation.ts が未発火 / モジュール分離で repository が空のとき
   *   route handler から呼ばれた際に lazy にロードする保険
   */
  private async ensureRepository(): Promise<void> {
    if (this.repository) return;
    if (!this.autoInitPromise) {
      this.autoInitPromise = (async () => {
        try {
          const mod = await import('@/lib/audit-repository');
          if (!this.repository) {
            this.repository = mod.auditRepository;
          }
        } catch {
          // ignore: テスト・ビルド時など Prisma が無い環境
        }
      })();
    }
    await this.autoInitPromise;
  }

  /**
   * 監査ログを記録（Trace IDは自動注入）
   */
  async record(entry: AuditLogEntry): Promise<AuditLogRecord | null> {
    await this.ensureRepository();
    if (!this.repository) {
      return null;
    }

    return this.repository.create({
      ...entry,
      actor: entry.actor ?? this.defaultActor,
      traceId: entry.traceId ?? getTraceId(),
    });
  }

  /**
   * 監査ログを照会
   */
  async query(options: AuditQueryOptions = {}): Promise<AuditLogRecord[]> {
    await this.ensureRepository();
    if (!this.repository) {
      return [];
    }

    return this.repository.findMany(options);
  }

  /**
   * 監査ログの件数を取得
   */
  async count(options: AuditQueryOptions = {}): Promise<number> {
    await this.ensureRepository();
    if (!this.repository) {
      return 0;
    }

    return this.repository.count(options);
  }

  /**
   * Issue関連のログを記録するヘルパー
   */
  async logIssueAction(
    action:
      | 'ISSUE_CREATE'
      | 'ISSUE_UPDATE'
      | 'ISSUE_START'
      | 'ISSUE_CLOSE'
      | 'ISSUE_DELETE'
      | 'ISSUE_STANDARDIZE',
    issueId: string,
    payload?: Record<string, unknown>,
    actor?: string
  ): Promise<void> {
    await this.record({
      action,
      entityType: 'Issue',
      entityId: issueId,
      payload,
      actor,
    });
  }

  /**
   * Proposal関連のログを記録するヘルパー
   */
  async logProposalAction(
    action: 'PROPOSAL_GENERATE' | 'PATCH_APPLY',
    proposalId: string,
    payload?: Record<string, unknown>,
    actor?: string
  ): Promise<void> {
    await this.record({
      action,
      entityType: 'Proposal',
      entityId: proposalId,
      payload,
      actor,
    });
  }

  /**
   * Git関連のログを記録するヘルパー
   */
  async logGitAction(
    action:
      | 'GIT_COMMIT'
      | 'GIT_BRANCH_CREATE'
      | 'GIT_BRANCH_DELETE'
      | 'MERGE_CLOSE'
      | 'DUPLICATE_MERGE',
    entityId: string,
    payload?: Record<string, unknown>,
    actor?: string
  ): Promise<void> {
    const GIT_SYSTEM_ACTIONS = new Set(['GIT_COMMIT', 'GIT_BRANCH_CREATE', 'GIT_BRANCH_DELETE']);
    await this.record({
      action,
      entityType: GIT_SYSTEM_ACTIONS.has(action) ? 'System' : 'Issue',
      entityId,
      payload,
      actor,
    });
  }

  /**
   * データガバナンス関連のログを記録するヘルパー (GPTsiteki Section 8.6)
   */
  async logDataAction(
    action:
      | 'DATA_ACCESS'
      | 'DATA_EXPORT'
      | 'ABSTRACTION_APPLIED'
      | 'PROVENANCE_RECORDED'
      | 'ACCESS_POLICY_CHANGE',
    entityId: string,
    payload?: Record<string, unknown>
  ): Promise<void> {
    await this.record({
      action,
      entityType: 'DataObject',
      entityId,
      payload,
    });
  }

  /**
   * ワークフロー関連のログを記録するヘルパー
   */
  async logWorkflowAction(
    action:
      | 'WORKFLOW_START'
      | 'WORKFLOW_COMPLETE'
      | 'WORKFLOW_FAIL'
      | 'WORKFLOW_CANCEL'
      | 'TASK_EXECUTE'
      | 'GATE_EVALUATE'
      | 'HUMAN_APPROVE'
      | 'HUMAN_REJECT',
    entityId: string,
    traceId: string,
    payload?: Record<string, unknown>,
    // ガバナンス・ハーネス: ゲート判定や承認に、ポリシー版・内容ハッシュ・重大度層を刻む
    meta?: { policyVersion?: string; policyHash?: string; severity?: AuditTier }
  ): Promise<void> {
    await this.record({
      action,
      entityType: 'WorkflowExecution',
      entityId,
      traceId,
      payload,
      policyVersion: meta?.policyVersion,
      policyHash: meta?.policyHash,
      severity: meta?.severity,
    });
  }
}

// シングルトンインスタンス（HMR/モジュール分離対策で globalThis に固定）
const globalForAudit = globalThis as unknown as { __flowops_audit_log?: AuditLogger };
export const auditLog: AuditLogger = globalForAudit.__flowops_audit_log ?? new AuditLogger();
if (process.env.NODE_ENV !== 'production') {
  globalForAudit.__flowops_audit_log = auditLog;
}

// クラスもエクスポート（テスト用）
export { AuditLogger };
