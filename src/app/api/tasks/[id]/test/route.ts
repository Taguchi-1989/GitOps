/**
 * POST /api/tasks/:id/test - マイクロタスクのドライラン実行
 *
 * サンプル入力でタスクを実行し、出力を確認する
 */

import { z } from 'zod';
import { taskRegistry, createTaskExecutor } from '@/core/orchestrator';
import { TaskInvocation } from '@/core/orchestrator/schemas/micro-task';
import {
  successResponse,
  notFoundResponse,
  internalErrorResponse,
  errorResponse,
  parseBody,
  sanitizeFlowId,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { generateTraceId } from '@/lib/trace-context';

const TestRequestSchema = z.object({
  input: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { data, error } = await parseBody(request, TestRequestSchema);
    if (error) return error;

    const traceId = generateTraceId();
    const executor = createTaskExecutor();

    const invocation: TaskInvocation = {
      traceId,
      executionId: `test-${Date.now()}`,
      nodeId: 'test-node',
      taskId: task.id,
      taskVersion: task.version,
      gitCommitHash: 'test-run',
      input: data.input,
      context: {
        flowId: 'test-flow',
        currentNodeLabel: 'Test Execution',
        previousNodes: [],
        roles: [],
        systems: [],
      },
    };

    const result = await executor.execute(task, invocation);

    return successResponse({
      traceId,
      taskId: task.id,
      result,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
