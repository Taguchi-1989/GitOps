import { aimsRepository, serializeAimsRecord } from '@/lib/aims-repository';
import { internalErrorResponse, notFoundResponse, successResponse } from '@/lib/api-utils';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const evidence = await aimsRepository.findEvidence(id);
    if (!evidence) return notFoundResponse('AIMS evidence');
    return successResponse(serializeAimsRecord(evidence));
  } catch (error) {
    return internalErrorResponse(error);
  }
}
