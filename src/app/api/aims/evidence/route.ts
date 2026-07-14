import { randomUUID } from 'node:crypto';
import { auditLog } from '@/core/audit';
import { CreateAimsEvidenceSchema, computeAimsSourceHash, normalizeAimsSource } from '@/core/aims';
import { aimsRepository, serializeAimsRecord } from '@/lib/aims-repository';
import {
  errorResponse,
  getAuditActor,
  internalErrorResponse,
  parseBody,
  parsePaginationParams,
  successResponse,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';

const EVIDENCE_STATUSES = new Set(['imported', 'under-review', 'reviewed', 'approved', 'rejected']);

export async function POST(request: Request) {
  try {
    const actor = getAuditActor(request);
    if (!actor) return errorResponse(API_ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);

    const { data, error } = await parseBody(request, CreateAimsEvidenceSchema);
    if (error) return error;
    const sourceText = normalizeAimsSource(data.sourceText);
    const sourceHash = computeAimsSourceHash(sourceText);
    const evidenceId = createEvidenceId();
    const record = await aimsRepository.createEvidence({
      ...data,
      sourceText,
      sourceHash,
      evidenceId,
      collectedBy: actor,
    });

    await auditLog.record({
      action: 'AIMS_EVIDENCE_IMPORT',
      entityType: 'AimsEvidence',
      entityId: record.id,
      actor,
      severity: 'thick',
      payload: {
        evidenceId,
        sourceHash,
        sourceType: data.sourceType,
        sensitivityLevel: data.sensitivityLevel,
        sourceLength: sourceText.length,
        tagCount: data.tags.length,
      },
    });

    const { sourceText: _sourceText, ...withoutSource } = record;
    return successResponse(
      serializeAimsRecord({ ...withoutSource, sourceLength: sourceText.length }),
      201
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { limit, offset } = parsePaginationParams(searchParams);
    const status = searchParams.get('status') || undefined;
    if (status && !EVIDENCE_STATUSES.has(status)) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Unknown evidence status', 400);
    }
    const { records, total } = await aimsRepository.listEvidence({ limit, offset, status });
    return successResponse({
      evidence: serializeAimsRecord(records),
      pagination: { total, limit, offset, hasMore: offset + records.length < total },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

function createEvidenceId(): string {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `AIMS-EVD-${day}-${randomUUID().slice(0, 8).toUpperCase()}`;
}
