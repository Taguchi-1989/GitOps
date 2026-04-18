/**
 * GET  /api/data-objects/:id/references - 横断参照一覧
 * POST /api/data-objects/:id/references - 横断参照作成
 */

import { CrossReferenceSchema } from '@/core/data/schemas';
import { dataObjectRepository } from '@/lib/data-object-repository';
import { auditLog } from '@/core/audit/logger';
import {
  successResponse,
  notFoundResponse,
  internalErrorResponse,
  parseBody,
} from '@/lib/api-utils';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await dataObjectRepository.findByObjectId(id);
    if (!existing) return notFoundResponse('DataObject');

    const { searchParams } = new URL(request.url);
    const direction = (searchParams.get('direction') || 'both') as 'source' | 'target' | 'both';

    const references = await dataObjectRepository.findCrossReferences(id, direction);
    return successResponse({ references });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await dataObjectRepository.findByObjectId(id);
    if (!existing) return notFoundResponse('DataObject');

    const { data, error } = await parseBody(request, CrossReferenceSchema);
    if (error) return error;

    const record = await dataObjectRepository.createCrossReference(data);

    await auditLog.logDataAction('PROVENANCE_RECORDED', id, {
      action: 'create_reference',
      referenceType: data.referenceType,
      targetObjectId: data.targetObjectId,
    });

    return successResponse(record, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
