/**
 * FlowOps - Flows API
 *
 * GET /api/flows - フロー一覧取得
 */

import { NextRequest } from 'next/server';
import { successResponse, internalErrorResponse } from '@/lib/api-utils';
import { listFlows } from '@/lib/flow-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/flows
 * フロー一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const flows = await listFlows();
    return successResponse({ flows });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
