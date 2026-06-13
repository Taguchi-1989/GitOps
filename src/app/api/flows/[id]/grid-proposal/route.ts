/**
 * FlowOps - Grid Edit Proposal API
 *
 * POST /api/flows/[id]/grid-proposal
 * グリッド編集(nodes/edges)を JSON Patch 化し、既存の Proposal→apply
 * パイプラインに合流させる。正本は YAML/Git のまま。
 *
 * body: { nodeRows, edgeRows, baseHash, intent?, issueId? }
 * - baseHash 不一致 → 409 (他で更新された)
 * - 検証エラー → 400 (details に CellError[] を JSON で格納しセルハイライトに使う)
 * - 成功 → 201 { proposal, issueId } (適用は POST /api/proposals/[id]/apply)
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
  sanitizeFlowId,
  getAuditActor,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { getFlow, getFlowYaml, getDictionary } from '@/lib/flow-service';
import { sha256, diffFlows, formatDiffAsHtml } from '@/core/patch';
import { FlowSchema } from '@/core/parser/schema';
import { rowsToFlow, validateRows, hasBlockingErrors, buildJsonPatch } from '@/core/grid';
import { generateHumanId } from '@/core/issue/humanId';
import { auditLog } from '@/core/audit';
import { logger } from '@/lib/logger';

const NodeRowSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  role: z.string(),
  system: z.string(),
  taskId: z.string(),
  description: z.string(),
});

const EdgeRowSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string(),
  condition: z.string(),
  dataLayer: z.string(),
});

const GridProposalBodySchema = z.object({
  nodeRows: z.array(NodeRowSchema),
  edgeRows: z.array(EdgeRowSchema),
  baseHash: z.string().min(1),
  intent: z.string().min(1).default('グリッド編集によるフロー更新'),
  issueId: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const safeId = sanitizeFlowId(id);
    if (!safeId) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Invalid flow ID', 400);
    }

    const { data, error } = await parseBody(request, GridProposalBodySchema);
    if (error) return error;

    const flowData = await getFlow(safeId);
    const currentYaml = await getFlowYaml(safeId);
    if (!flowData || !currentYaml) {
      return notFoundResponse('Flow');
    }

    // 1) 陳腐化検知(読込以降に他で更新されていないか)
    const currentHash = sha256(currentYaml);
    if (currentHash !== data.baseHash) {
      return errorResponse(
        API_ERROR_CODES.STALE_PROPOSAL,
        'フローが他で更新されています。再読込してからやり直してください。',
        409
      );
    }

    // 2) 行 -> Flow 再構築 + セル単位検証
    const cellErrors = validateRows(data.nodeRows, data.edgeRows);
    if (hasBlockingErrors(cellErrors)) {
      // details に CellError[] を JSON 格納(クライアントがセルをハイライト)
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        JSON.stringify(cellErrors.filter(e => e.severity === 'error')),
        400
      );
    }

    const newFlow = rowsToFlow(flowData.flow, data.nodeRows, data.edgeRows);

    // 3) スキーマのバックストップ検証
    const schemaResult = FlowSchema.safeParse(newFlow);
    if (!schemaResult.success) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        `スキーマ検証に失敗しました: ${schemaResult.error.issues
          .map(i => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
        400
      );
    }

    // 4) role/system 辞書チェック(ノード単位パッチのため再構築フローを直接検査)
    const dictionary = await getDictionary();
    const dictViolations: string[] = [];
    for (const [nodeId, node] of Object.entries(newFlow.nodes)) {
      if (node.role && dictionary.roles.length > 0 && !dictionary.roles.includes(node.role)) {
        dictViolations.push(`ノード ${nodeId}: 未知のrole "${node.role}"`);
      }
      if (
        node.system &&
        dictionary.systems.length > 0 &&
        !dictionary.systems.includes(node.system)
      ) {
        dictViolations.push(`ノード ${nodeId}: 未知のsystem "${node.system}"`);
      }
    }
    if (dictViolations.length > 0) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        `辞書にない値があります: ${dictViolations.join('; ')}`,
        400
      );
    }

    // 5) JSON Patch 生成
    const patches = buildJsonPatch(flowData.flow, newFlow);
    if (patches.length === 0) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, '変更がありません', 400);
    }

    // 6) Issue 解決(指定があれば検証、無ければ自動作成)
    const actor = getAuditActor(request);
    let issueId: string;
    if (data.issueId) {
      const issue = await prisma.issue.findUnique({ where: { id: data.issueId } });
      if (!issue) {
        return notFoundResponse('Issue');
      }
      if (issue.status !== 'in-progress') {
        return errorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `Issueのステータスが in-progress ではありません: ${issue.status}`,
          400
        );
      }
      if (issue.targetFlowId !== safeId) {
        return errorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Issueの対象フローが一致しません',
          400
        );
      }
      issueId = issue.id;
    } else {
      const created = await createGridIssue(safeId, flowData.flow.title, data, actor);
      issueId = created.id;
    }

    // 7) Diffプレビュー + Proposal 作成(既存 import ルートと同じレシピ)
    const diff = diffFlows(flowData.flow, newFlow);
    const diffPreview = diff.entries.length > 0 ? formatDiffAsHtml(diff) : null;

    const proposal = await prisma.proposal.create({
      data: {
        issueId,
        intent: data.intent,
        jsonPatch: JSON.stringify(patches),
        diffPreview,
        baseHash: data.baseHash,
        targetFlowId: safeId,
      },
    });

    await prisma.issue.update({ where: { id: issueId }, data: { status: 'proposed' } });

    await auditLog.logProposalAction(
      'PROPOSAL_GENERATE',
      proposal.id,
      {
        issueId,
        baseHash: data.baseHash,
        intent: data.intent,
        patchCount: patches.length,
        source: 'grid-editor',
      },
      actor
    );

    return successResponse({ proposal, issueId }, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

/** グリッド編集用の軽量Issueを humanId 重複リトライ付きで作成する。 */
async function createGridIssue(
  flowId: string,
  flowTitle: string,
  data: z.infer<typeof GridProposalBodySchema>,
  actor: string | undefined
): Promise<{ id: string; humanId: string }> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const issue = await prisma.$transaction(async tx => {
        const lastIssue = await tx.issue.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { humanId: true },
        });
        let nextSequence = 1;
        if (lastIssue) {
          const match = lastIssue.humanId.match(/ISS-(\d+)/);
          if (match) nextSequence = parseInt(match[1], 10) + 1;
        }
        const humanId = generateHumanId(nextSequence);
        return tx.issue.create({
          data: {
            humanId,
            title: `グリッド編集: ${flowTitle}`,
            description: `グリッドエディタによるフロー更新 (ノード${data.nodeRows.length}件 / エッジ${data.edgeRows.length}件)`,
            targetFlowId: flowId,
            status: 'in-progress',
          },
        });
      });

      await auditLog.record({
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: issue.id,
        actor,
        payload: { humanId: issue.humanId, source: 'grid-editor', targetFlowId: flowId },
      });

      return { id: issue.id, humanId: issue.humanId };
    } catch (e: unknown) {
      const isUniqueViolation =
        e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2002';
      if (isUniqueViolation && attempt < MAX_RETRIES - 1) {
        logger.warn({ attempt }, 'humanId conflict, retrying grid issue creation');
        continue;
      }
      throw e;
    }
  }
  throw new Error('Failed to create grid issue after retries');
}
