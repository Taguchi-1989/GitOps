/**
 * FlowOps - Flow Detail API
 * 
 * GET /api/flows/[id] - フロー詳細取得
 */

import { NextRequest } from 'next/server';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/api-utils';
import { getFlow } from '@/lib/flow-service';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/flows/[id]
 * フロー詳細（Mermaid付き）を取得
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
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
