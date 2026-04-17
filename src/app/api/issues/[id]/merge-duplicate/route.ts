/**
 * FlowOps - Merge Duplicate API
 *
 * POST /api/issues/[id]/merge-duplicate - 重複Issueを統合
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  internalErrorResponse,
  parseBody,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { canMergeDuplicate, generateDuplicateMergeSummary, IssueStatus } from '@/core/issue';
import { getGitManager } from '@/core/git';
import { auditLog } from '@/core/audit';

interface RouteParams {
  params: { id: string };
}

const MergeDuplicateBodySchema = z.object({
  canonicalId: z.string().min(1),
});

/**
 * POST /api/issues/[id]/merge-duplicate
 * このIssueを別のIssueに統合（重複として処理）
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // リクエストボディを解析
    const { data, error } = await parseBody(request, MergeDuplicateBodySchema);
    if (error) return error;

    // 重複Issue（統合される側）を取得
    const duplicate = await prisma.issue.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!duplicate) {
      return notFoundResponse('Duplicate Issue');
    }

    // 統合先Issue（正として残る側）を取得
    const canonical = await prisma.issue.findUnique({
      where: { id: data.canonicalId, deletedAt: null },
    });

    if (!canonical) {
      return notFoundResponse('Canonical Issue');
    }

    // 自分自身への統合を防止
    if (duplicate.id === canonical.id) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Cannot merge issue into itself', 400);
    }

    // 統合可否をチェック
    const check = canMergeDuplicate(
      duplicate.status as IssueStatus,
      canonical.status as IssueStatus
    );

    if (!check.allowed) {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        check.reason || 'Cannot merge duplicate',
        400
      );
    }

    // ブランチにコミットがあればcherry-pick
    let cherryPickedCommits: string[] = [];
    const git = getGitManager();

    if (duplicate.branchName) {
      const hasCommits = await git.hasCommits(duplicate.branchName);

      if (hasCommits) {
        if (!canonical.branchName) {
          // 統合先にブランチが無いとcherry-pickできず、ブランチ削除でコミットが失われる。
          // 利用者が気付けるよう 409 を返して中断する。
          return errorResponse(
            API_ERROR_CODES.INVALID_STATUS_TRANSITION,
            `Duplicate issue has commits on branch '${duplicate.branchName}' but canonical issue '${canonical.humanId}' has no branch to cherry-pick into. Start the canonical issue first.`,
            409
          );
        }
        // 統合先にブランチがあればcherry-pick
        cherryPickedCommits = await git.cherryPick(duplicate.branchName, canonical.branchName);
      }

      // 重複側のブランチを削除
      await git.deleteBranch(duplicate.branchName, true);
    }

    // DB更新（Git操作成功後のみ）
    const updatedDuplicate = await prisma.issue.update({
      where: { id: params.id },
      data: {
        status: 'merged-duplicate',
        canonicalId: canonical.id,
        branchName: null, // ブランチは削除済み
      },
    });

    // 監査ログ
    await auditLog.logGitAction('DUPLICATE_MERGE', duplicate.id, {
      canonicalId: canonical.id,
      canonicalHumanId: canonical.humanId,
      cherryPickedCommits: cherryPickedCommits.length,
    });

    const summary = generateDuplicateMergeSummary(
      duplicate.humanId,
      canonical.humanId,
      cherryPickedCommits.length
    );

    return successResponse({
      duplicate: updatedDuplicate,
      canonical: { id: canonical.id, humanId: canonical.humanId },
      cherryPickedCommits,
      summary,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
