/**
 * FlowOps - Issues API
 *
 * GET /api/issues - Issue一覧取得
 * POST /api/issues - Issue作成
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, internalErrorResponse, parseBody } from '@/lib/api-utils';
import { CreateIssueSchema } from '@/core/issue';
import { generateHumanId } from '@/core/issue/humanId';
import { auditLog } from '@/core/audit';

/**
 * GET /api/issues
 * Issue一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const targetFlowId = searchParams.get('targetFlowId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { deletedAt: null };

    if (status) {
      where.status = status;
    }

    if (targetFlowId) {
      where.targetFlowId = targetFlowId;
    }

    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { proposals: true, evidences: true },
          },
        },
      }),
      prisma.issue.count({ where }),
    ]);

    return successResponse({
      issues,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + issues.length < total,
      },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

/**
 * POST /api/issues
 * 新しいIssueを作成
 */
export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, CreateIssueSchema);
    if (error) return error;

    // 次のhumanIdを取得
    const lastIssue = await prisma.issue.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { humanId: true },
    });

    let nextSequence = 1;
    if (lastIssue) {
      const match = lastIssue.humanId.match(/ISS-(\d+)/);
      if (match) {
        nextSequence = parseInt(match[1], 10) + 1;
      }
    }

    const humanId = generateHumanId(nextSequence);

    // Issue作成
    const issue = await prisma.issue.create({
      data: {
        humanId,
        title: data.title,
        description: data.description,
        targetFlowId: data.targetFlowId,
        targetNodeId: data.targetNodeId,
        status: 'new',
      },
    });

    // 監査ログ
    await auditLog.record({
      action: 'ISSUE_CREATE',
      entityType: 'Issue',
      entityId: issue.id,
      payload: { humanId, title: data.title, targetFlowId: data.targetFlowId },
    });

    return successResponse(issue, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
