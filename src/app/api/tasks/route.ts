/**
 * GET /api/tasks - マイクロタスク一覧取得
 */

import { taskRegistry } from '@/core/orchestrator';
import { successResponse, internalErrorResponse } from '@/lib/api-utils';

export async function GET() {
  try {
    const tasks = await taskRegistry.getAllTasks();

    const summary = tasks.map(t => ({
      id: t.id,
      version: t.version,
      type: t.type,
      description: t.metadata.description,
      author: t.metadata.author,
      tags: t.metadata.tags || [],
      requiresHumanApproval: t.requiresHumanApproval,
    }));

    return successResponse(summary);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
