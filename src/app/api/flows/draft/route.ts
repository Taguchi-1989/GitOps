/**
 * FlowOps - Flow Draft API (Conversation-based)
 *
 * POST /api/flows/draft - 会話ベースでフローのたたき台を作成/更新
 *
 * 使い方:
 * 1. 初回: messages に業務プロセスの説明を送信
 * 2. 繰り返し: 返却されたquestionsに答える + 修正指示を送信
 * 3. 完成したら POST /api/flows/create で正式保存
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { ConversationBuildRequestSchema } from '@/core/flow-builder/conversation-builder';
import { createConversationBuilder } from '@/core/flow-builder/client-factory';
import { getDictionary } from '@/lib/flow-service';
import { auditLog } from '@/core/audit/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, ConversationBuildRequestSchema);
    if (error) return error;

    // 辞書を取得してリクエストに付与
    const dictionary = await getDictionary();
    const enrichedRequest = {
      ...data,
      targetLayer: data.targetLayer ?? ('L1' as const),
      roles: data.roles ?? dictionary.roles,
      systems: data.systems ?? dictionary.systems,
    };

    const builder = createConversationBuilder();
    const result = await builder.build(enrichedRequest);

    await auditLog.record({
      action: 'PROPOSAL_GENERATE',
      entityType: 'Flow',
      entityId: data.flowId || 'draft',
      payload: {
        method: 'conversation',
        messageCount: data.messages.length,
        targetLayer: data.targetLayer,
        hasValidFlow: result.flow !== null,
        validationErrors: result.validationErrors,
      },
    });

    return successResponse({
      yaml: result.yaml,
      mermaid: result.mermaid,
      questions: result.questions,
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
