import { describe, expect, it } from 'vitest';
import { exportDexpiJson, importDexpiJson } from './json';
import { sampleDexpiDocument } from './test-fixtures';

describe('DeXPI canonical JSON', () => {
  it('round-trips the canonical document', () => {
    const source = sampleDexpiDocument();
    const content = exportDexpiJson(source);
    const imported = importDexpiJson(content);
    expect(imported.document).toEqual(source);
    expect(imported.validation.valid).toBe(true);
  });

  it('rejects invalid JSON and schema mismatches with stable codes', () => {
    expect(() => importDexpiJson('{')).toThrowError(
      expect.objectContaining({ code: 'JSON_PARSE_FAILED' })
    );
    expect(() => importDexpiJson('{"schemaVersion":"wrong"}')).toThrowError(
      expect.objectContaining({ code: 'JSON_SCHEMA_INVALID' })
    );
  });
});
