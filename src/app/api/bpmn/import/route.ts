import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auditLog } from '@/core/audit/logger';
import {
  BPMN_MAX_INPUT_LENGTH,
  BpmnJsonError,
  BpmnMermaidError,
  BpmnXmlError,
  exportBpmnJson,
  exportBpmnLlmPrompt,
  exportBpmnMermaid,
  importBpmnJson,
  importBpmnMermaid,
  importBpmnXml,
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
  format: z.enum(['json', 'mermaid', 'bpmn-xml']),
  content: z.string().min(1).max(BPMN_MAX_INPUT_LENGTH),
});

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, RequestSchema);
    if (error) return error;

    const imported =
      data.format === 'json'
        ? importBpmnJson(data.content)
        : data.format === 'mermaid'
          ? importBpmnMermaid(data.content)
          : importBpmnXml(data.content);
    const document = imported.document;
    const validation = validateBpmnDocument(document);
    const warnings = [
      ...('warnings' in imported ? imported.warnings : []),
      ...validation.warnings.map(item => item.message),
    ].filter((value, index, all) => all.indexOf(value) === index);

    await auditLog.record({
      action: 'BPMN_IMPORT',
      entityType: 'BpmnDocument',
      entityId: document.definitions.targetNamespace,
      actor: getAuditActor(request),
      payload: {
        sourceFormat: data.format,
        profile: document.profile,
        processCount: validation.processCount,
        nodeCount: validation.nodeCount,
        warningCount: warnings.length,
      },
    });

    return successResponse({
      document,
      json: exportBpmnJson(document),
      mermaid: exportBpmnMermaid(document),
      llmPrompt: exportBpmnLlmPrompt(document),
      validation,
      warnings,
    });
  } catch (error) {
    if (
      error instanceof BpmnJsonError ||
      error instanceof BpmnMermaidError ||
      error instanceof BpmnXmlError
    ) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, error.message, 400);
    }
    return internalErrorResponse(error);
  }
}
