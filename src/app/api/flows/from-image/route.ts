/**
 * FlowOps - Flow From Image API
 *
 * POST /api/flows/from-image - 画像からフローを読み取り/改善
 *
 * 使い方:
 * 1. 初回: imageBase64 or imageUrl を送信 → フロー生成
 * 2. 改善: 返却されたYAML + feedback を送信 → フロー修正
 * 3. 画像再送信 + feedback で、読み取り精度を繰り返し改善
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { ImageReadRequestSchema } from '@/core/flow-builder/image-reader';
import { createImageReader } from '@/core/flow-builder/client-factory';
import { getDictionary } from '@/lib/flow-service';
import { auditLog } from '@/core/audit/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, ImageReadRequestSchema);
    if (error) return error;

    // 辞書を取得
    const dictionary = await getDictionary();
    const enrichedRequest = {
      ...data,
      targetLayer: data.targetLayer ?? ('L1' as const),
      roles: data.roles ?? dictionary.roles,
      systems: data.systems ?? dictionary.systems,
    };

    const reader = createImageReader();
    const result = await reader.read(enrichedRequest);

    await auditLog.record({
      action: 'PROPOSAL_GENERATE',
      entityType: 'Flow',
      entityId: data.flowId || 'image-draft',
      payload: {
        method: 'image-read',
        hasImage: !!(data.imageBase64 || data.imageUrl),
        hasFeedback: !!data.feedback,
        confidence: result.confidence,
        ambiguityCount: result.ambiguities.length,
        hasValidFlow: result.flow !== null,
      },
    });

    return successResponse({
      yaml: result.yaml,
      mermaid: result.mermaid,
      confidence: result.confidence,
      notes: result.notes,
      ambiguities: result.ambiguities,
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
