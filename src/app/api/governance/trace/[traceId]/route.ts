/**
 * GET /api/governance/trace/:traceId - Trace IDによるE2Eトレーサビリティ検索
 *
 * ISO 42001準拠: 特定のTrace IDをキーとして以下を即座に抽出
 * - ワークフロー実行レコード
 * - 全タスク実行（使用LLMモデル含む）
 * - 各タスクのGitコミットハッシュ（ロジックバージョン）
 * - Human-in-the-loopの承認/否認ログ（理由含む）
 * - 全監査ログエントリ
 */

import { prisma } from '@/lib/prisma';
import { auditLog } from '@/core/audit/logger';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/api-utils';

export async function GET(_request: Request, { params }: { params: Promise<{ traceId: string }> }) {
  try {
    const { traceId } = await params;

    // ワークフロー実行を検索
    const execution = await prisma.workflowExecution.findUnique({
      where: { traceId },
      include: {
        taskExecutions: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            nodeId: true,
            taskId: true,
            taskVersion: true,
            gitCommitHash: true,
            status: true,
            llmModelUsed: true,
            llmTokensInput: true,
            llmTokensOutput: true,
            durationMs: true,
            input: true,
            output: true,
            error: true,
            createdAt: true,
            completedAt: true,
          },
        },
        approvalRequests: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            nodeId: true,
            description: true,
            status: true,
            decision: true,
            reason: true,
            decidedBy: true,
            decidedAt: true,
            createdAt: true,
          },
        },
      },
    });

    // 監査ログを検索（traceIdで）
    const auditLogs = await auditLog.query({ traceId });

    if (!execution && auditLogs.length === 0) {
      return notFoundResponse('Trace');
    }

    // 使用されたLLMモデルの一覧
    const llmModelsUsed = execution
      ? [
          ...new Set(
            execution.taskExecutions.map(t => t.llmModelUsed).filter((m): m is string => m !== null)
          ),
        ]
      : [];

    // Gitコミットハッシュの一覧（ロジックバージョン）
    const gitVersions = execution
      ? (() => {
          const seen = new Map<
            string,
            { taskId: string; version: string; gitCommitHash: string }
          >();
          for (const t of execution.taskExecutions) {
            const key = `${t.taskId}:${t.taskVersion}:${t.gitCommitHash}`;
            if (!seen.has(key)) {
              seen.set(key, {
                taskId: t.taskId,
                version: t.taskVersion,
                gitCommitHash: t.gitCommitHash,
              });
            }
          }
          return [...seen.values()];
        })()
      : [];

    // Langfuseトレースリンク（設定されている場合）
    const langfuseHost = process.env.LANGFUSE_HOST || process.env.NEXT_PUBLIC_LANGFUSE_HOST;
    const langfuseTraceUrl = langfuseHost ? `${langfuseHost}/trace/${traceId}` : null;

    return successResponse({
      traceId,
      workflow: execution
        ? {
            executionId: execution.id,
            flowId: execution.flowId,
            status: execution.status,
            initiatorId: execution.initiatorId,
            currentNodeId: execution.currentNodeId,
            createdAt: execution.createdAt,
            updatedAt: execution.updatedAt,
            completedAt: execution.completedAt,
          }
        : null,
      taskExecutions: execution?.taskExecutions || [],
      approvalRequests: execution?.approvalRequests || [],
      auditLogs,
      summary: {
        llmModelsUsed,
        gitVersions,
        totalTaskExecutions: execution?.taskExecutions.length || 0,
        totalApprovalRequests: execution?.approvalRequests.length || 0,
        totalAuditEntries: auditLogs.length,
        langfuseTraceUrl,
      },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
