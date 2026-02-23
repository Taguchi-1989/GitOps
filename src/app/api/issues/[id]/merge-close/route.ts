/**
 * FlowOps - Merge & Close API
 *
 * POST /api/issues/[id]/merge-close - ブランチをマージしてクローズ
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
import { getGitManager } from '@/core/git';
import { auditLog } from '@/core/audit';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/issues/[id]/merge-close
 * ブランチをmainにマージしてIssueをクローズ
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: params.id },
    });

    if (!issue) {
      return notFoundResponse('Issue');
    }

    // ステータスチェック
    if (issue.status !== 'proposed') {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Cannot merge issue with status: ${issue.status}. Must be proposed.`,
        400
      );
    }

    // ブランチ確認
    if (!issue.branchName) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Issue has no branch to merge', 400);
    }

    // 適用済みProposalがあるか確認
    const appliedProposal = await prisma.proposal.findFirst({
      where: {
        issueId: issue.id,
        isApplied: true,
      },
    });

    if (!appliedProposal) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        'No proposal has been applied yet',
        400
      );
    }

    // Gitマージ
    const git = getGitManager();
    await git.mergeAndClose(issue.branchName);

    // DB更新（Git操作成功後のみ）
    const updatedIssue = await prisma.issue.update({
      where: { id: params.id },
      data: {
        status: 'merged',
      },
    });

    // 監査ログ
    await auditLog.logGitAction('MERGE_CLOSE', issue.id, {
      branchName: issue.branchName,
    });

    await auditLog.logIssueAction('ISSUE_CLOSE', issue.id, {
      status: 'merged',
    });

    return successResponse(updatedIssue);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
