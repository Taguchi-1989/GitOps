/**
 * POST /api/issues/[id]/return-to-progress
 *
 * proposed状態の課題を「差戻し」してin-progressに戻す。
 * 業務側承認者が「もう一度練り直し」を依頼する操作。
 * 判断理由は必須(監査エビデンス)。
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  internalErrorResponse,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { auditLog } from '@/core/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    let reason: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.reason === 'string') reason = body.reason.trim();
    } catch {
      /* fall through */
    }
    if (!reason) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, '差戻し理由は必須です', 400);
    }

    const issue = await prisma.issue.findUnique({ where: { id } });
    if (!issue) return notFoundResponse('Issue');

    if (issue.status !== 'proposed') {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        `差戻しは提案済(proposed)の課題のみ可能です。現状: ${issue.status}`,
        400
      );
    }

    const updated = await prisma.issue.update({
      where: { id },
      data: { status: 'in-progress' },
    });

    await auditLog.logIssueAction('ISSUE_UPDATE', issue.id, {
      from: 'proposed',
      to: 'in-progress',
      action: 'return-to-progress',
      reason,
    });

    return successResponse(updated);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
