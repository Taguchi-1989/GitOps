import {
  AimsConfigurationError,
  AimsReviewExecutionError,
  AimsSourceTooLargeError,
  executeAimsReview,
  StartAimsReviewSchema,
} from '@/core/aims';
import { EgressBlockedError } from '@/core/egress';
import { IngressBlockedError } from '@/core/ingress';
import { API_ERROR_CODES } from '@/core/types/api';
import { aimsRepository, serializeAimsRecord } from '@/lib/aims-repository';
import {
  errorResponse,
  getAuditActor,
  internalErrorResponse,
  notFoundResponse,
  parseBody,
  successResponse,
} from '@/lib/api-utils';
import { generateTraceId } from '@/lib/trace-context';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = getAuditActor(request);
    if (!actor) return errorResponse(API_ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    const { id } = await params;
    const evidence = await aimsRepository.findEvidence(id);
    if (!evidence) return notFoundResponse('AIMS evidence');
    if (evidence.status === 'under-review') {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        'This evidence already has a review in progress',
        409
      );
    }

    const { data, error } = await parseBody(request, StartAimsReviewSchema);
    if (error) return error;
    const traceId = request.headers.get('x-trace-id') || generateTraceId();
    const run = await executeAimsReview({ evidence, request: data, actor, traceId });
    return successResponse(serializeAimsRecord(run), 201);
  } catch (error) {
    if (error instanceof AimsSourceTooLargeError) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, error.message, 413);
    }
    if (error instanceof IngressBlockedError) {
      return errorResponse(
        API_ERROR_CODES.INGRESS_BLOCKED,
        `External LLM send blocked by ingress policy ${error.policyVersion}`,
        422
      );
    }
    if (error instanceof EgressBlockedError) {
      return errorResponse(API_ERROR_CODES.EGRESS_BLOCKED, 'LLM output was blocked', 422);
    }
    if (error instanceof AimsConfigurationError) {
      return errorResponse(API_ERROR_CODES.LLM_ERROR, error.message, 503);
    }
    if (error instanceof AimsReviewExecutionError) {
      return errorResponse(API_ERROR_CODES.LLM_ERROR, error.message, 502);
    }
    return internalErrorResponse(error);
  }
}
