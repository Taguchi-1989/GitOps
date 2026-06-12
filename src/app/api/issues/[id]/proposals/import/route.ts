/**
 * FlowOps - Manual Proposal Import API
 *
 * POST /api/issues/[id]/proposals/import
 * 外部AIの出力（コピペ）を検証して改善案として取り込む。LLM APIキーは不要。
 *
 * body: { text: string }  — AIの出力をそのまま貼り付けた文字列
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
import { ProposalOutputSchema } from '@/core/patch/types';
import { validateProposalConstraints } from '@/core/llm/validate-proposal';
import { sha256, applyPatches, diffFlows, formatDiffAsHtml } from '@/core/patch';
import { parseFlowYaml } from '@/core/parser';
import { extractJson } from '@/lib/extract-json';
import { auditLog } from '@/core/audit';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const issue = await prisma.issue.findUnique({ where: { id } });
    if (!issue) {
      return notFoundResponse('Issue');
    }

    if (issue.status !== 'in-progress') {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Cannot import proposal for issue with status: ${issue.status}. Must be in-progress.`,
        400
      );
    }

    if (!issue.targetFlowId) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        'Issue must have a targetFlowId to import proposal',
        400
      );
    }

    let body: { text?: unknown };
    try {
      body = await request.json();
    } catch {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Invalid JSON body', 400);
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'AIの出力が空です', 400);
    }

    // 前置き文・コードフェンス付きでもJSON部分を寛容に抽出
    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        '貼り付けた内容からJSONを見つけられませんでした。AIの回答全体をそのままコピーして貼り付けてください。',
        400
      );
    }

    const result = ProposalOutputSchema.safeParse(parsed);
    if (!result.success) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        `出力の形式が指定と異なります: ${result.error.issues
          .map(i => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
        400
      );
    }
    const proposalOutput = result.data;

    const dictionary = await getDictionary();
    const violations = validateProposalConstraints(
      proposalOutput,
      dictionary.roles,
      dictionary.systems
    );
    if (violations.length > 0) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        `ルール違反があります: ${violations.join('; ')}`,
        400
      );
    }

    const flowYaml = await getFlowYaml(issue.targetFlowId);
    if (!flowYaml) {
      return errorResponse(
        API_ERROR_CODES.NOT_FOUND,
        `Target flow not found: ${issue.targetFlowId}`,
        404
      );
    }

    const baseHash = sha256(flowYaml);

    // パッチが実際に適用できるか確認し、Diffプレビューを生成
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
      logger.warn({ err: e }, 'Failed to apply imported patches');
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        `パッチをフローに適用できませんでした: ${e instanceof Error ? e.message : String(e)}`,
        400
      );
    }

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

    await prisma.issue.update({
      where: { id },
      data: { status: 'proposed' },
    });

    const actor = getAuditActor(request);
    await auditLog.logProposalAction(
      'PROPOSAL_GENERATE',
      proposal.id,
      {
        issueId: issue.id,
        baseHash,
        intent: proposalOutput.intent,
        patchCount: proposalOutput.patches.length,
        source: 'manual-paste',
      },
      actor
    );

    return successResponse(proposal, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
