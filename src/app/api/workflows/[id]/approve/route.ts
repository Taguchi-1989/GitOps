/**
 * POST /api/workflows/:id/approve - 承認/否認の意思決定
 *
 * ISO 42001準拠: 理由(reason)は必須
 */

import { prisma } from '@/lib/prisma';
import {
  humanLoopManager,
  ApprovalDecisionSchema,
  compileWorkflow,
  workflowEngine,
} from '@/core/orchestrator';
import { getFlowYaml } from '@/lib/flow-service';
import { parseFlowYaml } from '@/core/parser';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  internalErrorResponse,
  parseBody,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // ワークフロー実行を取得
    const execution = await prisma.workflowExecution.findUnique({
      where: { id },
      include: {
        approvalRequests: {
          where: { status: 'pending' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!execution) {
      return notFoundResponse('WorkflowExecution');
    }

    if (execution.status !== 'paused-human-review') {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        'Workflow is not waiting for approval'
      );
    }

    const pendingRequest = execution.approvalRequests[0];
    if (!pendingRequest) {
      return errorResponse(API_ERROR_CODES.NOT_FOUND, 'No pending approval request found');
    }

    // リクエストボディをパース
    const { data, error } = await parseBody(request, ApprovalDecisionSchema);
    if (error) return error;

    // 承認/否認を記録
    await humanLoopManager.submitDecision(pendingRequest.id, data, execution.traceId);

    // 承認された場合、ワークフローを再開
    if (data.approved) {
      const flowYaml = await getFlowYaml(execution.flowId);
      if (!flowYaml) {
        return errorResponse(API_ERROR_CODES.NOT_FOUND, 'Flow not found');
      }

      const parseResult = parseFlowYaml(flowYaml, `${execution.flowId}.yaml`);
      if (!parseResult.success || !parseResult.flow) {
        return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Flow parse error');
      }

      const compiled = await compileWorkflow(parseResult.flow);

      // 承認されたノードの次のノードを取得
      const currentNode = compiled.nodes.get(execution.currentNodeId);
      const nextEdge = currentNode?.outgoingEdges[0];

      if (nextEdge) {
        const state = {
          executionId: execution.id,
          flowId: execution.flowId,
          traceId: execution.traceId,
          status: execution.status as 'paused-human-review',
          currentNodeId: execution.currentNodeId,
          stateData: execution.stateData as Record<string, unknown>,
          initiatorId: execution.initiatorId,
        };

        const updatedState = await workflowEngine.resumeExecution(compiled, state, nextEdge.to);

        return successResponse({
          executionId: execution.id,
          decision: data.approved ? 'approved' : 'rejected',
          reason: data.reason,
          workflowStatus: updatedState.status,
          currentNodeId: updatedState.currentNodeId,
        });
      }
    }

    // 否認された場合、ワークフローを失敗に遷移
    if (!data.approved) {
      await prisma.workflowExecution.update({
        where: { id },
        data: {
          status: 'failed',
          stateData: {
            ...(execution.stateData as Record<string, unknown>),
            rejectionReason: data.reason,
            rejectedBy: data.decidedBy,
          },
        },
      });
    }

    return successResponse({
      executionId: execution.id,
      decision: data.approved ? 'approved' : 'rejected',
      reason: data.reason,
      workflowStatus: data.approved ? 'running' : 'failed',
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
