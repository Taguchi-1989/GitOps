/**
 * FlowOps - Workflow Repository (Prisma Implementation)
 *
 * WorkflowEngine / HumanLoopManager 用の永続化実装。
 * orchestrator(core) は DB 非依存のため、Prisma 実装は lib 層で注入する。
 *
 * 重要: stateData / context / input / output / gate結果 は文字列カラムに
 *   JSON.stringify で保存する（既存 audit-repository.ts と同方針、
 *   SQLite↔PostgreSQL 差異を避けるため Prisma の Json 型は使わない）。
 */

import { prisma } from './prisma';
import type {
  IWorkflowRepository,
  WorkflowState,
  IApprovalRepository,
  ApprovalRequestRecord,
  ApprovalDecision,
  WorkflowStatus,
} from '@/core/orchestrator';

/**
 * 文字列 or オブジェクトを安全にオブジェクトへ復元
 */
function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

// --------------------------------------------------------
// Workflow Execution Repository
// --------------------------------------------------------
class PrismaWorkflowRepository implements IWorkflowRepository {
  async createExecution(state: WorkflowState): Promise<void> {
    await prisma.workflowExecution.create({
      data: {
        id: state.executionId,
        flowId: state.flowId,
        traceId: state.traceId,
        status: state.status,
        currentNodeId: state.currentNodeId,
        stateData: JSON.stringify(state.stateData ?? {}),
        initiatorId: state.initiatorId,
      },
    });
  }

  async updateExecution(executionId: string, updates: Partial<WorkflowState>): Promise<void> {
    const data: Record<string, unknown> = {};

    if (updates.status !== undefined) {
      data.status = updates.status;
      if (updates.status === 'completed' || updates.status === 'failed') {
        data.completedAt = new Date();
      }
    }
    if (updates.currentNodeId !== undefined) {
      data.currentNodeId = updates.currentNodeId;
    }
    if (updates.stateData !== undefined) {
      data.stateData = JSON.stringify(updates.stateData);
    }

    if (Object.keys(data).length === 0) return;

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data,
    });
  }

  async getExecution(executionId: string): Promise<WorkflowState | null> {
    const record = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });
    if (!record) return null;

    return {
      executionId: record.id,
      flowId: record.flowId,
      traceId: record.traceId,
      status: record.status as WorkflowStatus,
      currentNodeId: record.currentNodeId,
      stateData: parseJsonObject(record.stateData),
      initiatorId: record.initiatorId,
    };
  }

  async createTaskExecution(data: {
    workflowId: string;
    nodeId: string;
    taskId: string;
    taskVersion: string;
    gitCommitHash: string;
    status: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    llmModelUsed?: string;
    llmTokensInput?: number;
    llmTokensOutput?: number;
    durationMs?: number;
    traceId: string;
  }): Promise<string> {
    const isTerminal = data.status === 'success' || data.status === 'failure';
    const record = await prisma.taskExecution.create({
      data: {
        workflowId: data.workflowId,
        nodeId: data.nodeId,
        taskId: data.taskId,
        taskVersion: data.taskVersion,
        gitCommitHash: data.gitCommitHash,
        status: data.status,
        input: JSON.stringify(data.input ?? {}),
        output: data.output !== undefined ? JSON.stringify(data.output) : null,
        llmModelUsed: data.llmModelUsed ?? null,
        llmTokensInput: data.llmTokensInput ?? null,
        llmTokensOutput: data.llmTokensOutput ?? null,
        durationMs: data.durationMs ?? null,
        traceId: data.traceId,
        completedAt: isTerminal ? new Date() : null,
      },
    });
    return record.id;
  }

  async createApprovalRequest(data: {
    workflowId: string;
    nodeId: string;
    description: string;
    context: Record<string, unknown>;
  }): Promise<string> {
    const record = await prisma.approvalRequest.create({
      data: {
        workflowId: data.workflowId,
        nodeId: data.nodeId,
        description: data.description,
        context: JSON.stringify(data.context ?? {}),
      },
    });
    return record.id;
  }

  // NOTE: createGateEvaluation は フェーズ1-6 で IWorkflowRepository とともに追加する
  // （Prisma GateEvaluation モデル = フェーズ1-5 に依存するため）。
}

// --------------------------------------------------------
// Approval Request Repository
// --------------------------------------------------------
interface ApprovalRow {
  id: string;
  workflowId: string;
  nodeId: string;
  description: string;
  context: string;
  status: string;
  decision: string | null;
  reason: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

function mapApprovalRecord(row: ApprovalRow): ApprovalRequestRecord {
  return {
    id: row.id,
    workflowId: row.workflowId,
    nodeId: row.nodeId,
    description: row.description,
    context: parseJsonObject(row.context),
    status: row.status,
    decision: row.decision ?? undefined,
    reason: row.reason ?? undefined,
    decidedBy: row.decidedBy ?? undefined,
    decidedAt: row.decidedAt ?? undefined,
    createdAt: row.createdAt,
  };
}

class PrismaApprovalRepository implements IApprovalRepository {
  async getApprovalRequest(id: string): Promise<ApprovalRequestRecord | null> {
    const row = await prisma.approvalRequest.findUnique({ where: { id } });
    return row ? mapApprovalRecord(row) : null;
  }

  async getPendingRequests(workflowId?: string): Promise<ApprovalRequestRecord[]> {
    const rows = await prisma.approvalRequest.findMany({
      where: { status: 'pending', ...(workflowId ? { workflowId } : {}) },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapApprovalRecord);
  }

  async updateApprovalRequest(
    id: string,
    decision: ApprovalDecision
  ): Promise<ApprovalRequestRecord> {
    const row = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: decision.approved ? 'approved' : 'rejected',
        decision: decision.approved ? 'approved' : 'rejected',
        reason: decision.reason,
        decidedBy: decision.decidedBy,
        decidedAt: new Date(),
      },
    });
    return mapApprovalRecord(row);
  }
}

// --------------------------------------------------------
// Singletons
// --------------------------------------------------------
export const workflowRepository = new PrismaWorkflowRepository();
export const approvalRepository = new PrismaApprovalRepository();

export { PrismaWorkflowRepository, PrismaApprovalRepository };
