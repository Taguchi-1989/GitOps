import { aimsRepository, serializeAimsRecord } from '@/lib/aims-repository';
import { internalErrorResponse, notFoundResponse, successResponse } from '@/lib/api-utils';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const run = await aimsRepository.findRun(id);
    if (!run) return notFoundResponse('AIMS review');
    return successResponse(serializeAimsRecord(run));
  } catch (error) {
    return internalErrorResponse(error);
  }
}
