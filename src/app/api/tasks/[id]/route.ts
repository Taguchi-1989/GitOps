/**
 * GET /api/tasks/:id - マイクロタスク詳細取得
 */

import { taskRegistry } from '@/core/orchestrator';
import {
  successResponse,
  notFoundResponse,
  internalErrorResponse,
  sanitizeFlowId,
  errorResponse,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sanitizedId = sanitizeFlowId(id);
    if (!sanitizedId) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Invalid task ID');
    }

    const task = await taskRegistry.getTask(sanitizedId);
    if (!task) {
      return notFoundResponse('Task');
    }

    return successResponse(task);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
