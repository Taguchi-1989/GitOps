/**
 * FlowOps - Human-in-the-Loop Manager
 *
 * ISO 42001準拠の人間介入フロー管理
 * 承認/否認の意思決定と理由の記録を必須化
 */

import { ApprovalDecision } from './schemas/execution';
import { auditLog } from '../audit/logger';

export interface ApprovalRequestRecord {
  id: string;
  workflowId: string;
  nodeId: string;
  description: string;
  context: Record<string, unknown>;
  status: string;
  decision?: string;
  reason?: string;
  decidedBy?: string;
  decidedAt?: Date;
  createdAt: Date;
}

/**
 * 承認リクエスト永続化インターフェース
 */
export interface IApprovalRepository {
  getApprovalRequest(id: string): Promise<ApprovalRequestRecord | null>;
  getPendingRequests(workflowId?: string): Promise<ApprovalRequestRecord[]>;
  updateApprovalRequest(id: string, decision: ApprovalDecision): Promise<ApprovalRequestRecord>;
}

export class HumanLoopError extends Error {
  code: 'NOT_FOUND' | 'ALREADY_DECIDED' | 'INVALID_DECISION';

  constructor(code: 'NOT_FOUND' | 'ALREADY_DECIDED' | 'INVALID_DECISION', message: string) {
    super(message);
    this.name = 'HumanLoopError';
    this.code = code;
  }
}

export class HumanLoopManager {
  private repository: IApprovalRepository | null = null;

  setRepository(repo: IApprovalRepository): void {
    this.repository = repo;
  }

  /**
   * 承認待ちリクエスト一覧を取得
   */
  async getPendingRequests(workflowId?: string): Promise<ApprovalRequestRecord[]> {
    if (!this.repository) return [];
    return this.repository.getPendingRequests(workflowId);
  }

  /**
   * 承認/否認の意思決定を記録
   */
  async submitDecision(
    requestId: string,
    decision: ApprovalDecision,
    traceId: string
  ): Promise<ApprovalRequestRecord> {
    if (!this.repository) {
      throw new HumanLoopError('NOT_FOUND', 'Repository not configured');
    }

    const request = await this.repository.getApprovalRequest(requestId);
    if (!request) {
      throw new HumanLoopError('NOT_FOUND', `Approval request '${requestId}' not found`);
    }

    if (request.status !== 'pending') {
      throw new HumanLoopError(
        'ALREADY_DECIDED',
        `Approval request '${requestId}' has already been decided: ${request.status}`
      );
    }

    const updated = await this.repository.updateApprovalRequest(requestId, decision);

    // 監査ログに記録
    await auditLog.logWorkflowAction(
      decision.approved ? 'HUMAN_APPROVE' : 'HUMAN_REJECT',
      request.workflowId,
      traceId,
      {
        approvalRequestId: requestId,
        nodeId: request.nodeId,
        decision: decision.approved ? 'approved' : 'rejected',
        reason: decision.reason,
        decidedBy: decision.decidedBy,
      }
    );

    return updated;
  }
}

// シングルトン
export const humanLoopManager = new HumanLoopManager();

export { HumanLoopManager as HumanLoopManagerClass };
