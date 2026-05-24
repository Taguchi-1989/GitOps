/**
 * FlowOps - Issue Standardize API
 *
 * POST /api/issues/[id]/standardize - 標準化して完了（Act フェーズ）
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  internalErrorResponse,
  getAuditActor,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { auditLog } from '@/core/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/issues/[id]/standardize
 * 改善を標準化して Act フェーズを完了する
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const issue = await prisma.issue.findUnique({
      where: { id, deletedAt: null },
    });

    if (!issue) {
      return notFoundResponse('Issue');
    }

    if (issue.status !== 'merged') {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Cannot standardize issue with status: ${issue.status}. Must be 'merged'.`,
        400
      );
    }

    if (issue.standardizedAt) {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        'Issue is already standardized.',
        400
      );
    }

    const updatedIssue = await prisma.issue.update({
      where: { id },
      data: { standardizedAt: new Date() },
    });

    await auditLog.record({
      action: 'ISSUE_STANDARDIZE',
      entityType: 'Issue',
      entityId: issue.id,
      actor: getAuditActor(request),
      payload: { humanId: issue.humanId, standardizedAt: updatedIssue.standardizedAt },
    });

    return successResponse(updatedIssue);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
