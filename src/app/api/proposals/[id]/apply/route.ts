/**
 * FlowOps - Apply Proposal API
 *
 * POST /api/proposals/[id]/apply - 提案を適用
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
import { getFlowYaml, saveFlowYaml, getFlow } from '@/lib/flow-service';
import { applyPatchesToFlow, sha256, PatchApplyError, JsonPatch } from '@/core/patch';
import { stringifyFlow } from '@/core/parser';
import { getGitManager } from '@/core/git';
import { auditLog } from '@/core/audit';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/proposals/[id]/apply
 * 提案をYAMLに適用し、コミット
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Proposalを取得
    const proposal = await prisma.proposal.findUnique({
      where: { id: params.id },
      include: { issue: true },
    });

    if (!proposal) {
      return notFoundResponse('Proposal');
    }

    // 既に適用済みチェック
    if (proposal.isApplied) {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        'Proposal has already been applied',
        400
      );
    }

    // 対象フローの取得
    if (!proposal.targetFlowId) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Proposal has no target flow', 400);
    }

    const flowData = await getFlow(proposal.targetFlowId);
    if (!flowData) {
      return errorResponse(
        API_ERROR_CODES.NOT_FOUND,
        `Target flow not found: ${proposal.targetFlowId}`,
        404
      );
    }

    // 現在のYAMLを取得
    const currentYaml = await getFlowYaml(proposal.targetFlowId);
    if (!currentYaml) {
      return errorResponse(
        API_ERROR_CODES.NOT_FOUND,
        `Flow YAML not found: ${proposal.targetFlowId}`,
        404
      );
    }

    // baseHashチェック（陳腐化検知）
    const currentHash = sha256(currentYaml);
    if (proposal.baseHash && proposal.baseHash !== currentHash) {
      return errorResponse(
        API_ERROR_CODES.STALE_PROPOSAL,
        'Flow has been modified since proposal was generated. Please regenerate the proposal.',
        409
      );
    }

    // パッチを適用
    let patches: JsonPatch[];
    let patchedFlow;
    try {
      patches = JSON.parse(proposal.jsonPatch) as JsonPatch[];
      const result = applyPatchesToFlow(flowData.flow, patches);
      patchedFlow = result.flow;
    } catch (error) {
      if (error instanceof PatchApplyError) {
        return errorResponse(
          API_ERROR_CODES.PATCH_APPLY_FAILED,
          `Patch apply failed: ${error.message}`,
          400
        );
      }
      if (error instanceof SyntaxError) {
        return errorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `Stored proposal patch is not valid JSON: ${error.message}`,
          500
        );
      }
      throw error;
    }

    // YAMLに変換
    const newYaml = stringifyFlow(patchedFlow);

    // ファイルに保存
    await saveFlowYaml(proposal.targetFlowId, newYaml);

    // Gitコミット
    const git = getGitManager();
    const filePath = `spec/flows/${proposal.targetFlowId}.yaml`;
    const commitResult = await git.commitChanges(
      `feat: apply proposal for ${proposal.issue.humanId}`,
      [filePath]
    );

    // DB更新（Git操作成功後のみ）。
    // 失敗時はGitコミットを巻き戻し、DBとファイルシステム/Gitの整合性を保つ。
    let updatedProposal;
    try {
      updatedProposal = await prisma.proposal.update({
        where: { id: params.id },
        data: {
          isApplied: true,
          appliedAt: new Date(),
        },
      });
    } catch (dbError) {
      try {
        await git.revertLastCommit();
        logger.warn(
          { err: dbError, proposalId: params.id, commitHash: commitResult.hash },
          'DB update failed after git commit; reverted commit to maintain consistency'
        );
      } catch (revertError) {
        logger.error(
          {
            dbError,
            revertError,
            proposalId: params.id,
            commitHash: commitResult.hash,
          },
          'Failed to revert git commit after DB update failure - manual intervention required'
        );
      }
      throw dbError;
    }

    // 監査ログ（既にパース済みのpatchesを再利用 - 再パース時の例外リスクを排除）
    await auditLog.logProposalAction('PATCH_APPLY', proposal.id, {
      issueId: proposal.issueId,
      commitHash: commitResult.hash,
      patchCount: patches.length,
    });

    await auditLog.logGitAction('GIT_COMMIT', proposal.issueId, {
      commitHash: commitResult.hash,
      message: commitResult.message,
    });

    return successResponse({
      proposal: updatedProposal,
      commit: commitResult,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
