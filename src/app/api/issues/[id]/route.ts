/**
 * FlowOps - Issue Detail API
 *
 * GET /api/issues/[id] - Issue詳細取得
 * PATCH /api/issues/[id] - Issue更新
 * DELETE /api/issues/[id] - Issue削除
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  internalErrorResponse,
  errorResponse,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { UpdateIssueSchema } from '@/core/issue';
import { auditLog } from '@/core/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/issues/[id]
 * Issue詳細を取得
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const issue = await prisma.issue.findUnique({
      where: { id, deletedAt: null },
      include: {
        proposals: {
          orderBy: { createdAt: 'desc' },
        },
        evidences: {
          orderBy: { createdAt: 'desc' },
        },
        duplicates: {
          select: { id: true, humanId: true, title: true, status: true },
        },
        canonicalIssue: {
          select: { id: true, humanId: true, title: true, status: true },
        },
      },
    });

    if (!issue) {
      return notFoundResponse('Issue');
    }

    return successResponse(issue);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

/**
 * PATCH /api/issues/[id]
 * Issueを更新
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.issue.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return notFoundResponse('Issue');
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Invalid JSON body', 400);
    }

    const parsed = UpdateIssueSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, details, 400);
    }
    const data = parsed.data;

    // 判断理由 (任意。却下や状態変更時の監査エビデンス)
    const reason =
      rawBody &&
      typeof rawBody === 'object' &&
      'reason' in rawBody &&
      typeof (rawBody as { reason?: unknown }).reason === 'string'
        ? (rawBody as { reason: string }).reason.trim() || undefined
        : undefined;

    const before = {
      title: existing.title,
      description: existing.description,
      status: existing.status,
    };

    const issue = await prisma.issue.update({
      where: { id },
      data: {
        title: data.title ?? undefined,
        description: data.description ?? undefined,
        status: data.status ?? undefined,
      },
    });

    await auditLog.record({
      action: 'ISSUE_UPDATE',
      entityType: 'Issue',
      entityId: issue.id,
      payload: { before, after: data, ...(reason && { reason }) },
    });

    return successResponse(issue);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

/**
 * DELETE /api/issues/[id]
 * Issueを削除
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.issue.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return notFoundResponse('Issue');
    }

    // ソフトデリート（復旧可能）
    await prisma.issue.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // 監査ログ
    await auditLog.record({
      action: 'ISSUE_DELETE',
      entityType: 'Issue',
      entityId: existing.id,
      payload: { humanId: existing.humanId },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
