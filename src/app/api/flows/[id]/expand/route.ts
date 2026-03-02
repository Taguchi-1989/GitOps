/**
 * FlowOps - Flow Expand API
 *
 * POST /api/flows/:id/expand - フローをL0→L1 or L1→L2に展開
 *
 * 既存のフローを読み込み、下位レイヤーに詳細化した新しいフローを返す
 * 返却されたYAMLは POST /api/flows/create で保存可能
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { getFlowYaml, getDictionary } from '@/lib/flow-service';
import { createFlowExpander } from '@/core/flow-builder/client-factory';
import { auditLog } from '@/core/audit/logger';

export const dynamic = 'force-dynamic';

const ExpandRequestSchema = z.object({
  toLayer: z.enum(['L1', 'L2']),
  context: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: flowId } = await params;
    const { data, error } = await parseBody(request, ExpandRequestSchema);
    if (error) return error;

    // 対象フローを読み込み
    const yaml = await getFlowYaml(flowId);
    if (!yaml) {
      return errorResponse(API_ERROR_CODES.NOT_FOUND, `Flow "${flowId}" not found`, 404);
    }

    // 現在のレイヤーを判定
    const { parse: parseYaml } = await import('yaml');
    const rawData = parseYaml(yaml);
    const currentLayer = rawData?.layer;

    if (!currentLayer) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Flow has no layer defined', 400);
    }

    // 展開の整合性チェック
    const toLayer = data.toLayer;

    if (
      (currentLayer === 'L0' && toLayer !== 'L1') ||
      (currentLayer === 'L1' && toLayer !== 'L2') ||
      (currentLayer !== 'L0' && currentLayer !== 'L1')
    ) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        `Cannot expand from ${currentLayer} to ${toLayer}. Valid: L0→L1, L1→L2`,
        400
      );
    }

    const dictionary = await getDictionary();
    const expander = createFlowExpander();

    const result = await expander.expand({
      currentYaml: yaml,
      fromLayer: currentLayer as 'L0' | 'L1',
      toLayer,
      context: data.context,
      roles: dictionary.roles,
      systems: dictionary.systems,
    });

    await auditLog.record({
      action: 'PROPOSAL_GENERATE',
      entityType: 'Flow',
      entityId: flowId,
      payload: {
        method: 'expand',
        fromLayer: currentLayer as 'L0' | 'L1',
        toLayer,
        expandedNodes: result.expandedNodes,
        hasValidFlow: result.flow !== null,
      },
    });

    return successResponse({
      yaml: result.yaml,
      mermaid: result.mermaid,
      expandedNodes: result.expandedNodes,
      summary: result.summary,
      validationErrors: result.validationErrors,
      isValid: result.flow !== null && result.validationErrors.length === 0,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('LLM_API_KEY')) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, 500);
    }
    return internalErrorResponse(err);
  }
}
