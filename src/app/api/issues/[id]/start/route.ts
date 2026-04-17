/**
 * FlowOps - Issue Start API
 *
 * POST /api/issues/[id]/start - 作業開始（ブランチ作成）
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
import { generateBranchName, titleToSlug } from '@/core/issue/humanId';
import { getGitManager } from '@/core/git';
import { auditLog } from '@/core/audit';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/issues/[id]/start
 * 作業を開始し、ブランチを作成
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!issue) {
      return notFoundResponse('Issue');
    }

    // ステータスチェック
    if (issue.status !== 'new' && issue.status !== 'triage') {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Cannot start work on issue with status: ${issue.status}`,
        400
      );
    }

    // 既にブランチがある場合
    if (issue.branchName) {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Issue already has a branch: ${issue.branchName}`,
        400
      );
    }

    // ブランチ名を生成
    const slug = titleToSlug(issue.title);
    const branchName = generateBranchName(issue.humanId, slug);

    // Gitブランチを作成
    const git = getGitManager();
    await git.createBranch(branchName);

    // DB更新（Git操作成功後のみ）。失敗したら作成済みブランチを削除して
    // 孤立ブランチ + 未更新Issue の状態を残さない。
    let updatedIssue;
    try {
      updatedIssue = await prisma.issue.update({
        where: { id: params.id },
        data: {
          status: 'in-progress',
          branchName,
        },
      });
    } catch (dbError) {
      try {
        await git.deleteBranch(branchName, true);
        logger.warn(
          { err: dbError, issueId: params.id, branchName },
          'DB update failed after branch creation; deleted orphaned branch'
        );
      } catch (deleteError) {
        logger.error(
          { dbError, deleteError, issueId: params.id, branchName },
          'Failed to delete branch after DB update failure - manual cleanup required'
        );
      }
      throw dbError;
    }

    // 監査ログ
    await auditLog.logGitAction('GIT_BRANCH_CREATE', issue.id, { branchName });
    await auditLog.logIssueAction('ISSUE_START', issue.id, { branchName });

    return successResponse(updatedIssue);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
