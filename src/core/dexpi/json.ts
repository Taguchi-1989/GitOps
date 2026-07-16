import {
  DEXPI_MAX_INPUT_LENGTH,
  DexpiDocument,
  DexpiDocumentSchema,
  DexpiValidationResult,
} from './types';
import { validateDexpiDocument } from './validate';

export class DexpiJsonError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'DexpiJsonError';
  }
}

export function importDexpiJson(content: string): {
  document: DexpiDocument;
  validation: DexpiValidationResult;
} {
  if (!content.trim()) throw new DexpiJsonError('EMPTY_JSON', 'DeXPI JSON is empty');
  if (content.length > DEXPI_MAX_INPUT_LENGTH) {
    throw new DexpiJsonError('JSON_TOO_LARGE', 'DeXPI JSON exceeds the 5 MB input limit');
  }

  let input: unknown;
  try {
    input = JSON.parse(content);
  } catch (error) {
    throw new DexpiJsonError(
      'JSON_PARSE_FAILED',
      error instanceof Error ? error.message : 'Failed to parse DeXPI JSON'
    );
  }
  const parsed = DexpiDocumentSchema.safeParse(input);
  if (!parsed.success) {
    throw new DexpiJsonError(
      'JSON_SCHEMA_INVALID',
      parsed.error.issues
        .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')
    );
  }
  const validation = validateDexpiDocument(parsed.data);
  if (!validation.valid) {
    throw new DexpiJsonError(
      'DEXPI_DOCUMENT_INVALID',
      validation.errors.map(item => item.message).join('; ')
    );
  }
  return { document: parsed.data, validation };
}

export function exportDexpiJson(document: DexpiDocument): string {
  return `${JSON.stringify(DexpiDocumentSchema.parse(document), null, 2)}\n`;
}
