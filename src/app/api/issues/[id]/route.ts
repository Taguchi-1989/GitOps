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
  parseBody,
  getAuditActor,
} from '@/lib/api-utils';
import { UpdateIssueSchema, IssueStatus, validateStatusTransition } from '@/core/issue';
import { auditLog } from '@/core/audit';
import { API_ERROR_CODES } from '@/core/types/api';

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

    const { data, error } = await parseBody(request, UpdateIssueSchema);
    if (error) return error;

    // ステータス遷移のガード（closed-ineffective は merged からのみ）
    if (data.status && data.status !== existing.status) {
      const transition = validateStatusTransition(existing.status as IssueStatus, data.status);
      if (!transition.allowed) {
        return errorResponse(API_ERROR_CODES.INVALID_STATUS_TRANSITION, transition.reason);
      }
    }

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
        currentSituation: data.currentSituation ?? undefined,
        frequency: data.frequency ?? undefined,
        impact: data.impact ?? undefined,
        expectedState: data.expectedState ?? undefined,
        hypothesisCause: data.hypothesisCause ?? undefined,
        successMetric: data.successMetric ?? undefined,
        checkDueDate: data.checkDueDate ? new Date(data.checkDueDate) : undefined,
        metricBefore: data.metricBefore ?? undefined,
        metricAfter: data.metricAfter ?? undefined,
        checkDate: data.checkDate ? new Date(data.checkDate) : undefined,
        checkResult: data.checkResult ?? undefined,
        learning: data.learning ?? undefined,
        nextAction: data.nextAction ?? undefined,
      },
    });

    // 監査ログ（効果なし終了は専用アクションで記録する）
    const isCloseIneffective =
      data.status === 'closed-ineffective' && existing.status !== 'closed-ineffective';
    await auditLog.record({
      action: isCloseIneffective ? 'ISSUE_CLOSE_INEFFECTIVE' : 'ISSUE_UPDATE',
      entityType: 'Issue',
      entityId: issue.id,
      actor: getAuditActor(request),
      payload: isCloseIneffective
        ? {
            before,
            after: data,
            checkResult: issue.checkResult,
            learning: issue.learning,
          }
        : { before, after: data },
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
      actor: getAuditActor(request),
      payload: { humanId: existing.humanId },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
