import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auditLog } from '@/core/audit/logger';
import {
  DEXPI_MAX_INPUT_LENGTH,
  DexpiJsonError,
  DexpiMermaidError,
  DexpiXmlError,
  exportDexpiJson,
  exportDexpiMermaid,
  importDexpiJson,
  importDexpiMermaid,
  importDexpiXml,
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
  content: z.string().min(1).max(DEXPI_MAX_INPUT_LENGTH),
});

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, RequestSchema);
    if (error) return error;

    const imported =
      data.format === 'json'
        ? importDexpiJson(data.content)
        : data.format === 'mermaid'
          ? importDexpiMermaid(data.content)
          : importDexpiXml(data.content);
    const document = imported.document;
    const validation = validateDexpiDocument(document);
    const warnings = [
      ...('warnings' in imported ? imported.warnings : []),
      ...validation.warnings.map(item => item.message),
    ].filter((value, index, all) => all.indexOf(value) === index);

    await auditLog.record({
      action: 'DEXPI_IMPORT',
      entityType: 'DexpiDocument',
      entityId: document.model.uri,
      actor: getAuditActor(request),
      payload: {
        sourceFormat: data.format,
        profile: document.profile,
        objectCount: validation.objectCount,
        warningCount: warnings.length,
      },
    });

    return successResponse({
      document,
      json: exportDexpiJson(document),
      mermaid: exportDexpiMermaid(document),
      validation,
      warnings,
    });
  } catch (error) {
    if (
      error instanceof DexpiJsonError ||
      error instanceof DexpiMermaidError ||
      error instanceof DexpiXmlError
    ) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, error.message, 400);
    }
    return internalErrorResponse(error);
  }
}
