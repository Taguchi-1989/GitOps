import { describe, expect, it } from 'vitest';
import { exportBpmnJson, importBpmnJson } from './json';
import { createBpmnDocument } from './test-fixtures';

describe('BPMN normalized JSON', () => {
  it('round-trips the canonical document', () => {
    const document = createBpmnDocument();
    const imported = importBpmnJson(exportBpmnJson(document));
    expect(imported.document).toEqual(document);
    expect(imported.validation.valid).toBe(true);
  });

  it('rejects malformed JSON', () => {
    expect(() => importBpmnJson('{')).toThrow(/JSON/);
  });

  it('rejects empty, oversized, schema-invalid, and semantically invalid JSON', () => {
    expect(() => importBpmnJson(' ')).toThrow(/empty/);
    expect(() => importBpmnJson('x'.repeat(5_000_001))).toThrow(/5 MB/);
    expect(() => importBpmnJson('{}')).toThrow(/schemaVersion/);
    const document = createBpmnDocument();
    document.processes[0].sequenceFlows.Flow_End.targetRef = 'Missing_End';
    expect(() => importBpmnJson(JSON.stringify(document))).toThrow(/does not exist/);
  });
});
