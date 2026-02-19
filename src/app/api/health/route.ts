/**
 * FlowOps - Health Check API
 * 
 * GET /api/health - ヘルスチェック
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, internalErrorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * システムヘルスチェック
 */
export async function GET(request: NextRequest) {
  try {
    // DB接続確認
    await prisma.$queryRaw`SELECT 1`;
    
    return successResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
      },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
