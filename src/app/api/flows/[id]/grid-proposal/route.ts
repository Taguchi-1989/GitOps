/**
 * FlowOps - Flow Edit Proposal API (グリッド / キャンバス共通)
 *
 * POST /api/flows/[id]/grid-proposal
 * フロー編集を JSON Patch 化し、既存の Proposal→apply パイプラインに
 * 合流させる。正本は YAML/Git のまま。
 *
 * body(2形式。どちらか一方):
 *  - グリッド編集: { nodeRows, edgeRows, baseHash, intent?, issueId? }
 *  - キャンバス編集: { flow, baseHash, intent?, issueId? }
 *    (flow は完全な Flow。meta.position 等グリッド非表現の変更も反映される)
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
import {
  rowsToFlow,
  validateRows,
  hasBlockingErrors,
  buildJsonPatch,
  flowToNodeRows,
  flowToEdgeRows,
} from '@/core/grid';
import { generateHumanId } from '@/core/issue/humanId';
import { auditLog } from '@/core/audit';
import { logger } from '@/lib/logger';
import type { Flow, Node, Edge } from '@/core/parser/schema';

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

/**
 * グリッド形式(nodeRows/edgeRows)とキャンバス形式(flow)の両方を受け付ける。
 * 既存クライアント(グリッドエディタ)との後方互換のため nodeRows/edgeRows は
 * そのまま維持し、flow を追加の入力形式として許容する。
 */
const GridProposalBodySchema = z
  .object({
    nodeRows: z.array(NodeRowSchema).optional(),
    edgeRows: z.array(EdgeRowSchema).optional(),
    flow: FlowSchema.optional(),
    baseHash: z.string().min(1),
    intent: z.string().min(1).default('グリッド編集によるフロー更新'),
    issueId: z.string().optional(),
  })
  .refine(body => Boolean(body.flow) || Boolean(body.nodeRows && body.edgeRows), {
    message: 'flow か nodeRows/edgeRows のいずれかを指定してください',
  });

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** 空白除去し、空なら undefined を返す(rowsToFlow の opt と同じ規則)。 */
function opt(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

/**
 * キャンバス形式(flow)を rowsToFlow と同じ不変条件へ正規化する。
 * グリッド形式は rowsToFlow が下記を保証するが、flow は直採用のため
 * ここで同じ保証を明示的にかけないと YAML にそのままコミットされてしまう。
 *  - nodes/edges のレコードキーと要素の id が一致すること
 *  - 文字列フィールドを trim し、必須項目は trim 後も非空であること
 *  - 空文字になった任意項目は省略する(undefined 化)
 */
function normalizeCanvasFlow(flow: Flow): { flow: Flow } | { error: string } {
  const nodes: Record<string, Node> = {};
  for (const [key, node] of Object.entries(flow.nodes)) {
    if (key !== node.id) {
      return { error: `nodes のキー "${key}" と node.id "${node.id}" が一致しません` };
    }
    const id = node.id.trim();
    const label = node.label.trim();
    const type = node.type.trim();
    if (!id) return { error: `nodes のキー "${key}": IDは必須です` };
    if (!label) return { error: `ノード ${id}: ラベルは必須です` };
    if (!type) return { error: `ノード ${id}: タイプは必須です` };
    if (nodes[id]) return { error: `ノードIDが重複しています: ${id}` };
    const normalized: Node = { ...node, id, type: type as Node['type'], label };
    // 空文字になった任意項目はキーごと落とす(YAML に空値を残さない)
    for (const field of ['role', 'system', 'taskId'] as const) {
      const value = opt(normalized[field]);
      if (value) normalized[field] = value;
      else delete normalized[field];
    }
    nodes[id] = normalized;
  }

  const edges: Record<string, Edge> = {};
  for (const [key, edge] of Object.entries(flow.edges)) {
    if (key !== edge.id) {
      return { error: `edges のキー "${key}" と edge.id "${edge.id}" が一致しません` };
    }
    const id = edge.id.trim();
    const from = edge.from.trim();
    const to = edge.to.trim();
    if (!id) return { error: `edges のキー "${key}": IDは必須です` };
    if (!from || !to) return { error: `エッジ ${id}: from/to は必須です` };
    if (edges[id]) return { error: `エッジIDが重複しています: ${id}` };
    const normalized: Edge = { ...edge, id, from, to };
    for (const field of ['label', 'condition'] as const) {
      const value = opt(normalized[field]);
      if (value) normalized[field] = value;
      else delete normalized[field];
    }
    edges[id] = normalized;
  }

  return { flow: { ...flow, id: flow.id.trim(), nodes, edges } };
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

    // 2) 入力 -> Flow 再構築 + セル単位検証
    //    キャンバス形式は flow をそのまま採用する(meta.position 等を保つため)。
    //    検証は flow から導出した行に対して行い、グリッドと同じルールを共有する。
    const source = data.flow ? 'canvas-editor' : 'grid-editor';
    if (data.flow && data.flow.id !== safeId) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        'flow.id がURLのフローIDと一致しません',
        400
      );
    }

    // flow 直採用は rowsToFlow を通らないため、同じ不変条件をここで担保する
    let canvasFlow: Flow | null = null;
    if (data.flow) {
      const normalized = normalizeCanvasFlow(data.flow);
      if ('error' in normalized) {
        return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, normalized.error, 400);
      }
      canvasFlow = normalized.flow;
    }

    const nodeRows = canvasFlow ? flowToNodeRows(canvasFlow) : data.nodeRows!;
    const edgeRows = canvasFlow ? flowToEdgeRows(canvasFlow) : data.edgeRows!;

    const cellErrors = validateRows(nodeRows, edgeRows);
    if (hasBlockingErrors(cellErrors)) {
      // details に CellError[] を JSON 格納(クライアントがセルをハイライト)
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        JSON.stringify(cellErrors.filter(e => e.severity === 'error')),
        400
      );
    }

    // canvasFlow は現行フローのメタデータ(businessPurpose 等)を持たない可能性があるが、
    // buildJsonPatch が /nodes と /edges しか差分化しないため YAML 上のメタデータは
    // 失われない。この暗黙依存に乗っているので、patch 側の粒度を変えるときは要見直し。
    const newFlow = canvasFlow ?? rowsToFlow(flowData.flow, nodeRows, edgeRows);

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
      const created = await createFlowEditIssue(
        safeId,
        flowData.flow.title,
        { source, nodeCount: nodeRows.length, edgeCount: edgeRows.length },
        actor
      );
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
        source,
      },
      actor
    );

    return successResponse({ proposal, issueId }, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

/** フロー編集(グリッド/キャンバス)用の軽量Issueを humanId 重複リトライ付きで作成する。 */
async function createFlowEditIssue(
  flowId: string,
  flowTitle: string,
  origin: { source: string; nodeCount: number; edgeCount: number },
  actor: string | undefined
): Promise<{ id: string; humanId: string }> {
  const editorLabel = origin.source === 'canvas-editor' ? '図の編集' : 'グリッド編集';
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
            title: `${editorLabel}: ${flowTitle}`,
            description: `${editorLabel}によるフロー更新 (ノード${origin.nodeCount}件 / エッジ${origin.edgeCount}件)`,
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
        payload: { humanId: issue.humanId, source: origin.source, targetFlowId: flowId },
      });

      return { id: issue.id, humanId: issue.humanId };
    } catch (e: unknown) {
      const isUniqueViolation =
        e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2002';
      if (isUniqueViolation && attempt < MAX_RETRIES - 1) {
        logger.warn({ attempt }, 'humanId conflict, retrying flow edit issue creation');
        continue;
      }
      throw e;
    }
  }
  throw new Error('Failed to create flow edit issue after retries');
}
