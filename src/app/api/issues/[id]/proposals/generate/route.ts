/**
 * FlowOps - Generate Proposal API
 * 
 * POST /api/issues/[id]/proposals/generate - LLMで提案を生成
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
import { getFlowYaml, getDictionary } from '@/lib/flow-service';
import { getLLMClient, LLMError } from '@/core/llm';
import { sha256, applyPatches, diffFlows, formatDiffAsHtml } from '@/core/patch';
import { parseFlowYaml } from '@/core/parser';
import { auditLog } from '@/core/audit';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/issues/[id]/proposals/generate
 * LLMを使用して提案を生成
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
    if (issue.status !== 'in-progress') {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Cannot generate proposal for issue with status: ${issue.status}. Must be in-progress.`,
        400
      );
    }

    // 対象フローの確認
    if (!issue.targetFlowId) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        'Issue must have a targetFlowId to generate proposal',
        400
      );
    }

    // YAMLコンテンツを取得
    const flowYaml = await getFlowYaml(issue.targetFlowId);
    if (!flowYaml) {
      return errorResponse(
        API_ERROR_CODES.NOT_FOUND,
        `Target flow not found: ${issue.targetFlowId}`,
        404
      );
    }

    // 辞書を取得
    const dictionary = await getDictionary();

    // LLMで提案を生成
    let proposalOutput;
    try {
      const llm = getLLMClient();
      proposalOutput = await llm.generateProposal({
        issueTitle: issue.title,
        issueDescription: issue.description,
        flowYaml,
        roles: dictionary.roles,
        systems: dictionary.systems,
      });
    } catch (error) {
      if (error instanceof LLMError) {
        return errorResponse(
          API_ERROR_CODES.LLM_ERROR,
          `LLM error: ${error.message}`,
          500
        );
      }
      throw error;
    }

    // baseHashを計算
    const baseHash = sha256(flowYaml);

    // Diffプレビューを生成
    let diffPreview: string | null = null;
    try {
      const parseResult = parseFlowYaml(flowYaml);
      if (parseResult.success && parseResult.flow) {
        const patchedFlow = applyPatches(parseResult.flow, proposalOutput.patches);
        const diff = diffFlows(parseResult.flow, patchedFlow);
        if (diff.entries.length > 0) {
          diffPreview = formatDiffAsHtml(diff);
        }
      }
    } catch (e) {
      // Diffプレビュー生成失敗は致命的ではない
      console.warn('Failed to generate diff preview:', e);
    }

    // Proposalを保存
    const proposal = await prisma.proposal.create({
      data: {
        issueId: issue.id,
        intent: proposalOutput.intent,
        jsonPatch: JSON.stringify(proposalOutput.patches),
        diffPreview,
        baseHash,
        targetFlowId: issue.targetFlowId,
      },
    });

    // Issueステータスを更新
    await prisma.issue.update({
      where: { id: params.id },
      data: { status: 'proposed' },
    });

    // 監査ログ
    await auditLog.logProposalAction('PROPOSAL_GENERATE', proposal.id, {
      issueId: issue.id,
      baseHash,
      intent: proposalOutput.intent,
      patchCount: proposalOutput.patches.length,
    });

    return successResponse(proposal, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
