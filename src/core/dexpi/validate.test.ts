import { describe, expect, it } from 'vitest';
import { validateDexpiDocument } from './validate';
import { sampleDexpiDocument } from './test-fixtures';

describe('validateDexpiDocument', () => {
  it('accepts a connected DeXPI document', () => {
    const result = validateDexpiDocument(sampleDexpiDocument());
    expect(result.valid).toBe(true);
    expect(result.objectCount).toBe(4);
    expect(result.referenceCount).toBe(4);
  });

  it('rejects dangling references', () => {
    const document = sampleDexpiDocument();
    document.objects.pump_1.references.FlowTo = ['#missing'];
    const result = validateDexpiDocument(document);
    expect(result.valid).toBe(false);
    expect(result.errors.some(item => item.code === 'REFERENCE_NOT_FOUND')).toBe(true);
  });

  it('rejects composition cycles and multiple owners', () => {
    const document = sampleDexpiDocument();
    document.objects.pump_1.components.Loop = [{ kind: 'object', objectId: 'plant_model' }];
    const result = validateDexpiDocument(document);
    expect(result.errors.some(item => item.code === 'COMPOSITION_CYCLE')).toBe(true);
    expect(result.errors.some(item => item.code === 'MULTIPLE_COMPONENT_OWNERS')).toBe(true);
  });

  it('rejects objects that cannot be serialized from any root', () => {
    const document = sampleDexpiDocument();
    document.objects.orphan = {
      id: 'orphan',
      type: '/FlowOpsGenericPlantItem',
      data: {},
      components: {},
      references: {},
    };
    const result = validateDexpiDocument(document);
    expect(result.errors.some(item => item.code === 'UNREACHABLE_OBJECT')).toBe(true);
  });
});
