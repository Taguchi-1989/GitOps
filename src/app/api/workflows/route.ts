/**
 * POST /api/workflows - ワークフロー実行開始
 * GET  /api/workflows - ワークフロー実行一覧
 */

import { prisma } from '@/lib/prisma';
import {
  compileWorkflow,
  workflowEngine,
  WorkflowExecutionRequestSchema,
} from '@/core/orchestrator';
import { getFlowYaml } from '@/lib/flow-service';
import { parseFlowYaml } from '@/core/parser';
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
  parseBody,
  parsePaginationParams,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { generateTraceId } from '@/lib/trace-context';

export async function POST(request: Request) {
  try {
    const { data, error } = await parseBody(request, WorkflowExecutionRequestSchema);
    if (error) return error;

    // フローYAMLを読み込み・パース
    const flowYaml = await getFlowYaml(data.flowId);
    if (!flowYaml) {
      return errorResponse(API_ERROR_CODES.NOT_FOUND, `Flow '${data.flowId}' not found`);
    }

    const parseResult = parseFlowYaml(flowYaml, `${data.flowId}.yaml`);
    if (!parseResult.success || !parseResult.flow) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        `Failed to parse flow '${data.flowId}': ${parseResult.errors.map(e => e.message).join(', ')}`
      );
    }

    // ワークフローをコンパイル
    const compiled = await compileWorkflow(parseResult.flow);

    // 実行開始
    const traceId = generateTraceId();
    const state = await workflowEngine.startExecution(
      compiled,
      traceId,
      data.initiatorId,
      data.inputData
    );

    return successResponse(
      {
        executionId: state.executionId,
        traceId,
        flowId: state.flowId,
        status: state.status,
        currentNodeId: state.currentNodeId,
      },
      201
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const flowId = searchParams.get('flowId');
    const { limit } = parsePaginationParams(searchParams);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (flowId) where.flowId = flowId;

    const executions = await prisma.workflowExecution.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: {
          select: {
            taskExecutions: true,
            approvalRequests: true,
          },
        },
      },
    });

    return successResponse(executions);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
