/**
 * FlowOps - Issues API
 *
 * GET /api/issues - Issue一覧取得
 * POST /api/issues - Issue作成
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  internalErrorResponse,
  parseBody,
  parsePaginationParams,
} from '@/lib/api-utils';
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
    const { limit, offset } = parsePaginationParams(searchParams);

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

    // humanId生成 + Issue作成をトランザクションで原子的に実行
    // 同時リクエストによるhumanId重複を防ぐためリトライ付き
    const MAX_RETRIES = 3;
    let issue;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        issue = await prisma.$transaction(async tx => {
          const lastIssue = await tx.issue.findFirst({
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

          return tx.issue.create({
            data: {
              humanId,
              title: data.title,
              description: data.description,
              targetFlowId: data.targetFlowId,
              targetNodeId: data.targetNodeId,
              status: 'new',
            },
          });
        });
        break; // 成功
      } catch (e: unknown) {
        const isUniqueViolation =
          e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2002';
        if (isUniqueViolation && attempt < MAX_RETRIES - 1) {
          continue; // リトライ
        }
        throw e;
      }
    }

    // 監査ログ
    await auditLog.record({
      action: 'ISSUE_CREATE',
      entityType: 'Issue',
      entityId: issue!.id,
      payload: { humanId: issue!.humanId, title: data.title, targetFlowId: data.targetFlowId },
    });

    return successResponse(issue!, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
