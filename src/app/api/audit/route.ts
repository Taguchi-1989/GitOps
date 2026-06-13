/**
 * FlowOps - Audit Log API
 *
 * GET /api/audit - 監査ログ照会
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
  parsePaginationParams,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { buildAuditWhere } from '@/lib/audit-repository';
import { parseAuditFilters } from '@/core/export/audit-filters';

export const dynamic = 'force-dynamic';

/**
 * GET /api/audit
 * 監査ログを取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseAuditFilters(searchParams);
    if (!parsed.ok) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, parsed.error, 400);
    }
    const { limit, offset } = parsePaginationParams(searchParams);

    const where = buildAuditWhere(parsed.filters);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return successResponse({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
