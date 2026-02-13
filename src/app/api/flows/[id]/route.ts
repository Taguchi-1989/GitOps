/**
 * FlowOps - Flow Detail API
 * 
 * GET /api/flows/[id] - フロー詳細取得
 */

import { NextRequest } from 'next/server';
import { successResponse, notFoundResponse, internalErrorResponse, errorResponse, sanitizeFlowId } from '@/lib/api-utils';
import { getFlow } from '@/lib/flow-service';
import { API_ERROR_CODES } from '@/core/types/api';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/flows/[id]
 * フロー詳細（Mermaid付き）を取得
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    if (!sanitizeFlowId(params.id)) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Invalid flow ID', 400);
    }
    const flowData = await getFlow(params.id);
    
    if (!flowData) {
      return notFoundResponse('Flow');
    }

    return successResponse({
      flow: flowData.flow,
      mermaid: flowData.mermaid,
      filePath: flowData.filePath,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
