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
  parseBody,
} from '@/lib/api-utils';
import { UpdateIssueSchema } from '@/core/issue';
import { auditLog } from '@/core/audit';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/issues/[id]
 * Issue詳細を取得
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: params.id, deletedAt: null },
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
    const existing = await prisma.issue.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return notFoundResponse('Issue');
    }

    const { data, error } = await parseBody(request, UpdateIssueSchema);
    if (error) return error;

    const before = {
      title: existing.title,
      description: existing.description,
      status: existing.status,
    };

    const issue = await prisma.issue.update({
      where: { id: params.id },
      data: {
        title: data.title ?? undefined,
        description: data.description ?? undefined,
        status: data.status ?? undefined,
      },
    });

    // 監査ログ
    await auditLog.record({
      action: 'ISSUE_UPDATE',
      entityType: 'Issue',
      entityId: issue.id,
      payload: { before, after: data },
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
    const existing = await prisma.issue.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return notFoundResponse('Issue');
    }

    // ソフトデリート（復旧可能）
    await prisma.issue.update({
      where: { id: params.id },
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
