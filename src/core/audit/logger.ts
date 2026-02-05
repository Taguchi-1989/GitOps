/**
 * FlowOps - Audit Logger
 * 
 * 監査ログの記録と照会
 */

import { AuditLogEntry, AuditQueryOptions, AuditAction, AuditEntityType } from './types';

// Note: 実際のPrismaクライアントはlibから注入される
// ここではインターフェースのみ定義

export interface AuditLogRecord {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: unknown;
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
   * 監査ログを記録
   */
  async record(entry: AuditLogEntry): Promise<AuditLogRecord | null> {
    if (!this.repository) {
      // リポジトリが未設定の場合はコンソールに出力
      console.log('[AuditLog]', {
        ...entry,
        actor: entry.actor || this.defaultActor,
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    return this.repository.create({
      ...entry,
      actor: entry.actor || this.defaultActor,
    });
  }

  /**
   * 監査ログを照会
   */
  async query(options: AuditQueryOptions = {}): Promise<AuditLogRecord[]> {
    if (!this.repository) {
      console.warn('[AuditLog] Repository not set, returning empty array');
      return [];
    }

    return this.repository.findMany(options);
  }

  /**
   * 監査ログの件数を取得
   */
  async count(options: AuditQueryOptions = {}): Promise<number> {
    if (!this.repository) {
      return 0;
    }

    return this.repository.count(options);
  }

  /**
   * Issue関連のログを記録するヘルパー
   */
  async logIssueAction(
    action: 'ISSUE_CREATE' | 'ISSUE_UPDATE' | 'ISSUE_START' | 'ISSUE_CLOSE',
    issueId: string,
    payload?: Record<string, unknown>
  ): Promise<void> {
    await this.record({
      action,
      entityType: 'Issue',
      entityId: issueId,
      payload,
    });
  }

  /**
   * Proposal関連のログを記録するヘルパー
   */
  async logProposalAction(
    action: 'PROPOSAL_GENERATE' | 'PATCH_APPLY',
    proposalId: string,
    payload?: Record<string, unknown>
  ): Promise<void> {
    await this.record({
      action,
      entityType: 'Proposal',
      entityId: proposalId,
      payload,
    });
  }

  /**
   * Git関連のログを記録するヘルパー
   */
  async logGitAction(
    action: 'GIT_COMMIT' | 'GIT_BRANCH_CREATE' | 'GIT_BRANCH_DELETE' | 'MERGE_CLOSE' | 'DUPLICATE_MERGE',
    entityId: string,
    payload?: Record<string, unknown>
  ): Promise<void> {
    await this.record({
      action,
      entityType: action.startsWith('GIT') ? 'System' : 'Issue',
      entityId,
      payload,
    });
  }
}

// シングルトンインスタンス
export const auditLog = new AuditLogger();

// クラスもエクスポート（テスト用）
export { AuditLogger };
