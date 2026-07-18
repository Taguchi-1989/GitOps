import {
  BPMN_MAX_INPUT_LENGTH,
  BpmnDocument,
  BpmnDocumentSchema,
  BpmnValidationResult,
} from './types';
import { validateBpmnDocument } from './validate';

export class BpmnJsonError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'BpmnJsonError';
  }
}

export function importBpmnJson(content: string): {
  document: BpmnDocument;
  validation: BpmnValidationResult;
} {
  if (!content.trim()) throw new BpmnJsonError('EMPTY_JSON', 'BPMN JSON is empty');
  if (content.length > BPMN_MAX_INPUT_LENGTH) {
    throw new BpmnJsonError('JSON_TOO_LARGE', 'BPMN JSON exceeds the 5 MB input limit');
  }

  let input: unknown;
  try {
    input = JSON.parse(content);
  } catch (error) {
    throw new BpmnJsonError(
      'JSON_PARSE_FAILED',
      error instanceof Error ? error.message : 'Failed to parse BPMN JSON'
    );
  }
  const parsed = BpmnDocumentSchema.safeParse(input);
  if (!parsed.success) {
    throw new BpmnJsonError(
      'JSON_SCHEMA_INVALID',
      parsed.error.issues
        .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')
    );
  }
  const validation = validateBpmnDocument(parsed.data);
  if (!validation.valid) {
    throw new BpmnJsonError(
      'BPMN_DOCUMENT_INVALID',
      validation.errors.map(item => item.message).join('; ')
    );
  }
  return { document: parsed.data, validation };
}

export function exportBpmnJson(document: BpmnDocument): string {
  return `${JSON.stringify(BpmnDocumentSchema.parse(document), null, 2)}\n`;
}
