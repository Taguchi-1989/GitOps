import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auditLog } from '@/core/audit/logger';
import {
  BpmnDocumentSchema,
  BpmnXmlError,
  exportBpmnJson,
  exportBpmnLlmPrompt,
  exportBpmnMermaid,
  exportBpmnXml,
  validateBpmnDocument,
} from '@/core/bpmn';
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
  format: z.enum(['json', 'mermaid', 'bpmn-xml', 'llm-prompt']),
  document: BpmnDocumentSchema,
});

const FORMAT_METADATA = {
  json: { extension: 'json', mimeType: 'application/json' },
  mermaid: { extension: 'mmd', mimeType: 'text/plain' },
  'bpmn-xml': { extension: 'bpmn', mimeType: 'application/xml' },
  'llm-prompt': { extension: 'md', mimeType: 'text/markdown' },
} as const;

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, RequestSchema);
    if (error) return error;
    const validation = validateBpmnDocument(data.document);
    if (!validation.valid) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        validation.errors.map(item => item.message).join('; '),
        400
      );
    }

    const content =
      data.format === 'json'
        ? exportBpmnJson(data.document)
        : data.format === 'mermaid'
          ? exportBpmnMermaid(data.document)
          : data.format === 'llm-prompt'
            ? exportBpmnLlmPrompt(data.document)
            : exportBpmnXml(data.document);
    const metadata = FORMAT_METADATA[data.format];
    const processName = data.document.processes[0]?.id ?? 'FlowOpsProcess';
    const fileName = `${processName}.${metadata.extension}`;

    await auditLog.record({
      action: 'BPMN_EXPORT',
      entityType: 'BpmnDocument',
      entityId: data.document.definitions.targetNamespace,
      actor: getAuditActor(request),
      payload: {
        targetFormat: data.format,
        profile: data.document.profile,
        processCount: validation.processCount,
        nodeCount: validation.nodeCount,
      },
    });

    return successResponse({ content, fileName, mimeType: metadata.mimeType, validation });
  } catch (error) {
    if (error instanceof BpmnXmlError) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, error.message, 400);
    }
    return internalErrorResponse(error);
  }
}
