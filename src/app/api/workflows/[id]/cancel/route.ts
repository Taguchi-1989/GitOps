/**
 * POST /api/workflows/:id/cancel - ワークフローをキャンセル
 */

import { prisma } from '@/lib/prisma';
import { auditLog } from '@/core/audit/logger';
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  internalErrorResponse,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const execution = await prisma.workflowExecution.findUnique({
      where: { id },
    });

    if (!execution) {
      return notFoundResponse('WorkflowExecution');
    }

    if (execution.status === 'completed' || execution.status === 'cancelled') {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Cannot cancel workflow in status '${execution.status}'`
      );
    }

    await prisma.workflowExecution.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    await auditLog.logWorkflowAction('WORKFLOW_CANCEL', id, execution.traceId, {
      flowId: execution.flowId,
      previousStatus: execution.status,
    });

    return successResponse({
      executionId: id,
      status: 'cancelled',
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
