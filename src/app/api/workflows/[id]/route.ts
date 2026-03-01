/**
 * GET /api/workflows/:id - ワークフロー実行状態取得
 */

import { prisma } from '@/lib/prisma';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/api-utils';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const execution = await prisma.workflowExecution.findUnique({
      where: { id },
      include: {
        taskExecutions: {
          orderBy: { createdAt: 'asc' },
        },
        approvalRequests: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!execution) {
      return notFoundResponse('WorkflowExecution');
    }

    return successResponse(execution);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
