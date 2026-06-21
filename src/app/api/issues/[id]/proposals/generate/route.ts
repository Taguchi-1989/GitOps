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
  getAuditActor,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { getFlowYaml, getDictionary } from '@/lib/flow-service';
import { getLLMClient, LLMError } from '@/core/llm';
import { sha256, applyPatches, diffFlows, formatDiffAsHtml } from '@/core/patch';
import { parseFlowYaml } from '@/core/parser';
import { auditLog } from '@/core/audit';
import { guardIngress, IngressBlockedError } from '@/core/ingress';
import { guardEgress, EgressBlockedError } from '@/core/egress';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/issues/[id]/proposals/generate
 * LLMを使用して提案を生成
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const issue = await prisma.issue.findUnique({
      where: { id },
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

    // 入口ゲート（ガバナンス・ハーネス §4.1）: 外部送出前に機密混入を決定論的に検査。
    // 結合型は伏字化、値型/判定不能は block（人間承認フローへ）。判定は監査ログへ記録。
    let gatedTitle = issue.title;
    let gatedDescription = issue.description;
    let gatedFlowYaml = flowYaml;
    try {
      const { fields } = await guardIngress(
        {
          issueTitle: issue.title,
          issueDescription: issue.description,
          flowYaml,
        },
        { entityId: issue.id, entityType: 'Issue', actor: getAuditActor(request) ?? undefined }
      );
      gatedTitle = fields.issueTitle;
      gatedDescription = fields.issueDescription;
      gatedFlowYaml = fields.flowYaml;
    } catch (error) {
      if (error instanceof IngressBlockedError) {
        return errorResponse(
          API_ERROR_CODES.INGRESS_BLOCKED,
          `Ingress gate blocked external send (機密混入の疑い). ${error.message}`,
          422
        );
      }
      throw error;
    }

    // LLMで提案を生成（入口ゲート通過後の安全化済みテキストを使用）
    let proposalOutput;
    try {
      const llm = getLLMClient();
      proposalOutput = await llm.generateProposal({
        issueTitle: gatedTitle,
        issueDescription: gatedDescription,
        flowYaml: gatedFlowYaml,
        roles: dictionary.roles,
        systems: dictionary.systems,
      });
    } catch (error) {
      if (error instanceof LLMError) {
        return errorResponse(API_ERROR_CODES.LLM_ERROR, `LLM error: ${error.message}`, 500);
      }
      throw error;
    }

    // 出口ゲート（ガバナンス・ハーネス §4.2）: 生成出力に既知危険（秘密の反射・破壊的
    // コマンド・スクリプト注入等）が無いか独立検出系で検査。high検出でblock（永続化しない）。
    // 位置づけ(OUTG-3): 既知危険の確率的削減 + 入口の二重化トリップ。ゼロデイは非担保。
    try {
      await guardEgress(proposalOutput, {
        entityId: issue.id,
        entityType: 'Proposal',
        actor: getAuditActor(request) ?? undefined,
      });
    } catch (error) {
      if (error instanceof EgressBlockedError) {
        return errorResponse(
          API_ERROR_CODES.EGRESS_BLOCKED,
          `Egress gate blocked generated output (既知危険の疑い). ${error.message}`,
          422
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
      logger.warn({ err: e }, 'Failed to generate diff preview');
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
      where: { id },
      data: { status: 'proposed' },
    });

    // 監査ログ
    const actor = getAuditActor(request);
    if (actor) {
      await auditLog.logProposalAction(
        'PROPOSAL_GENERATE',
        proposal.id,
        {
          issueId: issue.id,
          baseHash,
          intent: proposalOutput.intent,
          patchCount: proposalOutput.patches.length,
        },
        actor
      );
    } else {
      await auditLog.logProposalAction('PROPOSAL_GENERATE', proposal.id, {
        issueId: issue.id,
        baseHash,
        intent: proposalOutput.intent,
        patchCount: proposalOutput.patches.length,
      });
    }

    return successResponse(proposal, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
