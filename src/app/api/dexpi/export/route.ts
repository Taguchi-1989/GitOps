import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auditLog } from '@/core/audit/logger';
import {
  DexpiDocumentSchema,
  DexpiXmlError,
  exportDexpiJson,
  exportDexpiMermaid,
  exportDexpiXml,
  validateDexpiDocument,
} from '@/core/dexpi';
import { API_ERROR_CODES } from '@/core/types/api';
import {
  errorResponse,
  getAuditActor,
  internalErrorResponse,
  parseBody,
  successResponse,
} from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  format: z.enum(['json', 'mermaid', 'dexpi-xml']),
  document: DexpiDocumentSchema,
});

const FORMAT_METADATA = {
  json: { extension: 'json', mimeType: 'application/json' },
  mermaid: { extension: 'mmd', mimeType: 'text/plain' },
  'dexpi-xml': { extension: 'xml', mimeType: 'application/xml' },
} as const;

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, RequestSchema);
    if (error) return error;
    const validation = validateDexpiDocument(data.document);
    if (!validation.valid) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        validation.errors.map(item => item.message).join('; '),
        400
      );
    }

    const content =
      data.format === 'json'
        ? exportDexpiJson(data.document)
        : data.format === 'mermaid'
          ? exportDexpiMermaid(data.document)
          : exportDexpiXml(data.document);
    const metadata = FORMAT_METADATA[data.format];
    const fileName = `${data.document.model.name}.${metadata.extension}`;

    await auditLog.record({
      action: 'DEXPI_EXPORT',
      entityType: 'DexpiDocument',
      entityId: data.document.model.uri,
      actor: getAuditActor(request),
      payload: {
        targetFormat: data.format,
        profile: data.document.profile,
        objectCount: validation.objectCount,
      },
    });

    return successResponse({
      content,
      fileName,
      mimeType: metadata.mimeType,
      validation,
    });
  } catch (error) {
    if (error instanceof DexpiXmlError) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, error.message, 400);
    }
    return internalErrorResponse(error);
  }
}
