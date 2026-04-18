/**
 * POST /api/data-objects - DataObject登録
 * GET  /api/data-objects - DataObject検索
 */

import { DataObjectSchema } from '@/core/data/schemas';
import { dataObjectRepository } from '@/lib/data-object-repository';
import { auditLog } from '@/core/audit/logger';
import {
  successResponse,
  internalErrorResponse,
  parseBody,
  parsePaginationParams,
} from '@/lib/api-utils';

export async function POST(request: Request) {
  try {
    const { data, error } = await parseBody(request, DataObjectSchema);
    if (error) return error;

    const record = await dataObjectRepository.create(data);
    await auditLog.logDataAction('DATA_ACCESS', record.objectId, {
      action: 'create',
      objectType: data.objectType,
      sensitivityLevel: data.sensitivityLevel,
    });

    return successResponse(record, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { limit, offset } = parsePaginationParams(searchParams);

    const options = {
      objectType: searchParams.get('objectType') || undefined,
      sensitivityLevel: searchParams.get('sensitivityLevel') || undefined,
      parentId: searchParams.get('parentId') || undefined,
      owner: searchParams.get('owner') || undefined,
      validationStatus: searchParams.get('validationStatus') || undefined,
      limit,
      offset,
    };

    const [records, total] = await Promise.all([
      dataObjectRepository.findMany(options),
      dataObjectRepository.count(options),
    ]);

    return successResponse({
      dataObjects: records,
      pagination: { total, limit, offset, hasMore: offset + records.length < total },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
