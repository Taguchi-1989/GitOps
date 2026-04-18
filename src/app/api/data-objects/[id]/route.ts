/**
 * GET    /api/data-objects/:id - 個別DataObject取得
 * PATCH  /api/data-objects/:id - DataObject更新
 * DELETE /api/data-objects/:id - DataObject削除
 */

import { DataObjectSchema } from '@/core/data/schemas';
import { dataObjectRepository } from '@/lib/data-object-repository';
import { auditLog } from '@/core/audit/logger';
import {
  successResponse,
  notFoundResponse,
  internalErrorResponse,
  parseBody,
} from '@/lib/api-utils';

const DataObjectPatchSchema = DataObjectSchema.partial().omit({ objectId: true, createdAt: true });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const record = await dataObjectRepository.findByObjectId(id);
    if (!record) return notFoundResponse('DataObject');
    return successResponse(record);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await dataObjectRepository.findByObjectId(id);
    if (!existing) return notFoundResponse('DataObject');

    const { data, error } = await parseBody(request, DataObjectPatchSchema);
    if (error) return error;

    const record = await dataObjectRepository.update(id, data);

    await auditLog.logDataAction('DATA_ACCESS', id, {
      action: 'update',
      updatedFields: Object.keys(data),
    });

    return successResponse(record);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await dataObjectRepository.findByObjectId(id);
    if (!existing) return notFoundResponse('DataObject');

    await dataObjectRepository.delete(id);

    await auditLog.logDataAction('DATA_ACCESS', id, {
      action: 'delete',
      objectType: existing.objectType,
      sensitivityLevel: existing.sensitivityLevel,
    });

    return successResponse({ deleted: true });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
