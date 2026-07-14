import { auditLog, sha256Hex } from '@/core/audit';
import { AimsHumanDecisionSchema } from '@/core/aims';
import { API_ERROR_CODES } from '@/core/types/api';
import {
  AimsDecisionConflictError,
  aimsRepository,
  serializeAimsRecord,
} from '@/lib/aims-repository';
import {
  errorResponse,
  getAuditActor,
  internalErrorResponse,
  notFoundResponse,
  parseBody,
  successResponse,
} from '@/lib/api-utils';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = getAuditActor(request);
    if (!actor) return errorResponse(API_ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    const { id } = await params;
    const existing = await aimsRepository.findRun(id);
    if (!existing) return notFoundResponse('AIMS review');

    const { data, error } = await parseBody(request, AimsHumanDecisionSchema);
    if (error) return error;
    const run = await aimsRepository.recordDecision(existing.id, data, actor);
    if (!run) return notFoundResponse('AIMS review');

    await auditLog.record({
      action: 'AIMS_REVIEW_DECISION',
      entityType: 'AimsReviewRun',
      entityId: existing.id,
      traceId: existing.traceId,
      actor,
      severity: 'thick',
      payload: {
        decision: data.decision,
        reasonHash: sha256Hex(data.reason),
        finalOutputHash: existing.finalOutputHash,
      },
    });
    return successResponse(serializeAimsRecord(run));
  } catch (error) {
    if (error instanceof AimsDecisionConflictError) {
      return errorResponse(API_ERROR_CODES.INVALID_STATUS_TRANSITION, error.message, 409);
    }
    return internalErrorResponse(error);
  }
}
