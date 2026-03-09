import { describe, it, expect } from 'vitest';
import {
  DataObjectTypeSchema,
  FragmentTypeSchema,
  SemanticObjectTypeSchema,
  TransformationTypeSchema,
  EvidenceLinkSchema,
  EvidenceLinkRelationshipSchema,
  TransformationEventSchema,
  AbstractionPolicyTypeSchema,
  ReIdentificationRiskSchema,
  AbstractionMetadataSchema,
  OutputArtifactMetadataSchema,
  ValidationStatusSchema,
  DataObjectSchema,
  CrossReferenceSchema,
  CrossReferenceTypeSchema,
  DataObjectMapSchema,
  EvidenceLinkMapSchema,
  TransformationEventMapSchema,
  CrossReferenceMapSchema,
} from './schemas';

// --------------------------------------------------------
// Enum Schemas
// --------------------------------------------------------

describe('DataObjectTypeSchema', () => {
  it('accepts all 5 types', () => {
    for (const t of [
      'document',
      'fragment',
      'semantic-object',
      'evidence-link',
      'transformation-event',
    ]) {
      expect(DataObjectTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it('rejects invalid type', () => {
    expect(DataObjectTypeSchema.safeParse('file').success).toBe(false);
  });
});

describe('FragmentTypeSchema', () => {
  it('accepts all fragment types', () => {
    for (const t of [
      'page',
      'paragraph',
      'table',
      'figure',
      'cell-range',
      'formula',
      'annotation',
    ]) {
      expect(FragmentTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it('rejects invalid type', () => {
    expect(FragmentTypeSchema.safeParse('slide').success).toBe(false);
  });
});

describe('SemanticObjectTypeSchema', () => {
  it('accepts all semantic object types', () => {
    for (const t of [
      'equipment',
      'recipe',
      'condition',
      'material',
      'procedure',
      'conclusion',
      'constraint',
    ]) {
      expect(SemanticObjectTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it('rejects invalid type', () => {
    expect(SemanticObjectTypeSchema.safeParse('unknown').success).toBe(false);
  });
});

describe('TransformationTypeSchema', () => {
  it('accepts all transformation types', () => {
    for (const t of [
      'ocr',
      'extraction',
      'conversion',
      'summarization',
      'verification',
      'approval',
      'abstraction',
    ]) {
      expect(TransformationTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it('rejects invalid type', () => {
    expect(TransformationTypeSchema.safeParse('magic').success).toBe(false);
  });
});

describe('EvidenceLinkRelationshipSchema', () => {
  it('accepts all relationship types', () => {
    for (const t of ['supports', 'contradicts', 'supplements', 'derives-from', 'references']) {
      expect(EvidenceLinkRelationshipSchema.safeParse(t).success).toBe(true);
    }
  });
});

describe('AbstractionPolicyTypeSchema', () => {
  it('accepts all 8 policy types', () => {
    for (const t of [
      'masking',
      'range',
      'binning',
      'relative',
      'tokenization',
      'condition-only',
      'result-only',
      'delta-only',
    ]) {
      expect(AbstractionPolicyTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it('rejects invalid type', () => {
    expect(AbstractionPolicyTypeSchema.safeParse('encryption').success).toBe(false);
  });
});

describe('ReIdentificationRiskSchema', () => {
  it('accepts all risk levels', () => {
    for (const t of ['negligible', 'low', 'medium', 'high', 'critical']) {
      expect(ReIdentificationRiskSchema.safeParse(t).success).toBe(true);
    }
  });
});

describe('ValidationStatusSchema', () => {
  it('accepts all 4 statuses', () => {
    for (const t of ['unverified', 'machine-verified', 'human-verified', 'official']) {
      expect(ValidationStatusSchema.safeParse(t).success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    expect(ValidationStatusSchema.safeParse('auto-verified').success).toBe(false);
  });
});

describe('CrossReferenceTypeSchema', () => {
  it('accepts all reference types', () => {
    for (const t of [
      'cites',
      'derived-from',
      'related-to',
      'supersedes',
      'contradicts',
      'abstracts',
    ]) {
      expect(CrossReferenceTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it('rejects invalid type', () => {
    expect(CrossReferenceTypeSchema.safeParse('links-to').success).toBe(false);
  });
});

// --------------------------------------------------------
// Composite Schemas
// --------------------------------------------------------

describe('EvidenceLinkSchema', () => {
  const validLink = {
    id: 'el-001',
    claimObjectId: 'obj-100',
    evidenceObjectId: 'obj-200',
    relationshipType: 'supports' as const,
  };

  it('accepts a valid evidence link', () => {
    const result = EvidenceLinkSchema.safeParse(validLink);
    expect(result.success).toBe(true);
  });

  it('accepts link with all optional fields', () => {
    const result = EvidenceLinkSchema.safeParse({
      ...validLink,
      confidence: 0.85,
      description: 'Strong supporting evidence',
      createdAt: '2026-03-08T10:00:00+09:00',
    });
    expect(result.success).toBe(true);
  });

  it('accepts link without optional fields', () => {
    const result = EvidenceLinkSchema.safeParse(validLink);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confidence).toBeUndefined();
      expect(result.data.description).toBeUndefined();
    }
  });

  it('rejects empty id', () => {
    expect(EvidenceLinkSchema.safeParse({ ...validLink, id: '' }).success).toBe(false);
  });

  it('rejects invalid relationship type', () => {
    expect(
      EvidenceLinkSchema.safeParse({ ...validLink, relationshipType: 'unknown' }).success
    ).toBe(false);
  });

  it('rejects invalid createdAt (non ISO 8601)', () => {
    expect(EvidenceLinkSchema.safeParse({ ...validLink, createdAt: 'yesterday' }).success).toBe(
      false
    );
  });

  it('rejects confidence out of range', () => {
    expect(EvidenceLinkSchema.safeParse({ ...validLink, confidence: 1.5 }).success).toBe(false);
    expect(EvidenceLinkSchema.safeParse({ ...validLink, confidence: -0.1 }).success).toBe(false);
  });
});

describe('TransformationEventSchema', () => {
  const validEvent = {
    id: 'te-001',
    type: 'ocr' as const,
    inputObjectIds: ['obj-100'],
    outputObjectIds: ['obj-101'],
    executedBy: 'ocr-engine-v2',
    executedAt: '2026-03-08T10:00:00+09:00',
  };

  it('accepts a valid event', () => {
    const result = TransformationEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it('accepts event with all optional fields', () => {
    const result = TransformationEventSchema.safeParse({
      ...validEvent,
      parameters: { resolution: 300, language: 'ja' },
      confidence: 0.95,
      metadata: { processingTimeMs: 1200 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts event without optional fields', () => {
    const result = TransformationEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parameters).toBeUndefined();
      expect(result.data.confidence).toBeUndefined();
    }
  });

  it('rejects missing executedBy', () => {
    const { executedBy, ...rest } = validEvent;
    expect(TransformationEventSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects empty executedBy', () => {
    expect(TransformationEventSchema.safeParse({ ...validEvent, executedBy: '' }).success).toBe(
      false
    );
  });
});

describe('AbstractionMetadataSchema', () => {
  const validMeta = {
    abstractionPolicyType: 'masking' as const,
    originalDataRef: 'obj-500',
  };

  it('accepts valid abstraction metadata', () => {
    const result = AbstractionMetadataSchema.safeParse(validMeta);
    expect(result.success).toBe(true);
  });

  it('applies defaults', () => {
    const result = AbstractionMetadataSchema.safeParse(validMeta);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reverseReferable).toBe(false);
      expect(result.data.reIdentificationRisk).toBe('low');
      expect(result.data.exportAllowed).toBe(false);
    }
  });

  it('accepts full metadata with allowedPurposes', () => {
    const result = AbstractionMetadataSchema.safeParse({
      ...validMeta,
      reverseReferable: true,
      reIdentificationRisk: 'medium',
      exportAllowed: true,
      allowedPurposes: ['research', 'quality-analysis'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    expect(AbstractionMetadataSchema.safeParse({}).success).toBe(false);
    expect(AbstractionMetadataSchema.safeParse({ abstractionPolicyType: 'masking' }).success).toBe(
      false
    );
  });

  it('rejects invalid reIdentificationRisk', () => {
    expect(
      AbstractionMetadataSchema.safeParse({ ...validMeta, reIdentificationRisk: 'unknown' }).success
    ).toBe(false);
  });
});

describe('OutputArtifactMetadataSchema', () => {
  const validOutput = {
    sourceObjectIds: ['obj-100', 'obj-200'],
    generatedAt: '2026-03-08T10:00:00+09:00',
    generatedBy: 'report-generator-v1',
  };

  it('accepts valid output metadata', () => {
    const result = OutputArtifactMetadataSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it('applies defaults for regenerable', () => {
    const result = OutputArtifactMetadataSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.regenerable).toBe(false);
    }
  });

  it('rejects empty sourceObjectIds', () => {
    expect(
      OutputArtifactMetadataSchema.safeParse({ ...validOutput, sourceObjectIds: [] }).success
    ).toBe(false);
  });

  it('accepts without optional fields', () => {
    const result = OutputArtifactMetadataSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outputLabel).toBeUndefined();
      expect(result.data.citations).toBeUndefined();
    }
  });

  it('accepts citations with full detail', () => {
    const result = OutputArtifactMetadataSchema.safeParse({
      ...validOutput,
      outputLabel: '技術報告書 v2.1',
      citations: [
        { objectId: 'obj-100', label: '材料強度試験結果', location: 'Table 3' },
        { objectId: 'obj-200' },
      ],
      regenerable: true,
    });
    expect(result.success).toBe(true);
  });
});

// --------------------------------------------------------
// DataObjectSchema
// --------------------------------------------------------

describe('DataObjectSchema', () => {
  const validDataObject = {
    objectId: 'obj-2026-000123',
    objectType: 'document' as const,
    createdAt: '2026-03-08T10:00:00+09:00',
    updatedAt: '2026-03-08T10:00:00+09:00',
  };

  it('accepts a valid minimal data object', () => {
    const result = DataObjectSchema.safeParse(validDataObject);
    expect(result.success).toBe(true);
  });

  it('applies defaults', () => {
    const result = DataObjectSchema.safeParse(validDataObject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sensitivityLevel).toBe('L1');
      expect(result.data.exportPolicy).toBe('unrestricted');
    }
  });

  it('accepts a full data object with all optional fields', () => {
    const result = DataObjectSchema.safeParse({
      ...validDataObject,
      parentId: 'doc-parent-001',
      sensitivityLevel: 'L4',
      sourceHash: 'sha256:abc123',
      owner: 'tanaka',
      version: '3.1',
      accessPolicyRef: 'policy-L4-high-confidential',
      contentRef: 'store://semantic/obj-2026-000123.json',
      exportPolicy: 'abstracted-only',
      semanticTags: ['recipe', 'constraint', 'safety-critical'],
      provenanceRef: 'prov://run-88421',
      validationRef: 'val://check-1092',
      validationStatus: 'human-verified',
      fragmentType: 'table',
      meta: { source: 'legacy-system' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts data object with fragmentType', () => {
    const result = DataObjectSchema.safeParse({
      ...validDataObject,
      objectType: 'fragment',
      fragmentType: 'table',
    });
    expect(result.success).toBe(true);
  });

  it('accepts data object with semanticObjectType', () => {
    const result = DataObjectSchema.safeParse({
      ...validDataObject,
      objectType: 'semantic-object',
      semanticObjectType: 'equipment',
    });
    expect(result.success).toBe(true);
  });

  it('accepts data object with abstractionMetadata', () => {
    const result = DataObjectSchema.safeParse({
      ...validDataObject,
      objectType: 'semantic-object',
      abstractionMetadata: {
        abstractionPolicyType: 'range',
        originalDataRef: 'obj-original-001',
        reverseReferable: false,
        reIdentificationRisk: 'medium',
        exportAllowed: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts data object with outputArtifactMetadata', () => {
    const result = DataObjectSchema.safeParse({
      ...validDataObject,
      objectType: 'document',
      outputArtifactMetadata: {
        sourceObjectIds: ['obj-100'],
        generatedAt: '2026-03-08T10:00:00+09:00',
        generatedBy: 'report-gen',
        regenerable: true,
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts data object without optional fields (backward compatible)', () => {
    const result = DataObjectSchema.safeParse(validDataObject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentId).toBeUndefined();
      expect(result.data.sourceHash).toBeUndefined();
      expect(result.data.fragmentType).toBeUndefined();
      expect(result.data.abstractionMetadata).toBeUndefined();
      expect(result.data.outputArtifactMetadata).toBeUndefined();
    }
  });

  it('rejects missing objectId', () => {
    const { objectId, ...rest } = validDataObject;
    expect(DataObjectSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing objectType', () => {
    const { objectType, ...rest } = validDataObject;
    expect(DataObjectSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing createdAt', () => {
    const { createdAt, ...rest } = validDataObject;
    expect(DataObjectSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid objectType', () => {
    expect(DataObjectSchema.safeParse({ ...validDataObject, objectType: 'file' }).success).toBe(
      false
    );
  });

  it('rejects invalid sensitivityLevel', () => {
    expect(DataObjectSchema.safeParse({ ...validDataObject, sensitivityLevel: 'L9' }).success).toBe(
      false
    );
  });

  it('rejects non-ISO 8601 createdAt', () => {
    expect(
      DataObjectSchema.safeParse({ ...validDataObject, createdAt: 'not-a-date' }).success
    ).toBe(false);
  });

  it('rejects non-ISO 8601 updatedAt', () => {
    expect(
      DataObjectSchema.safeParse({ ...validDataObject, updatedAt: '2026/03/08' }).success
    ).toBe(false);
  });
});

// --------------------------------------------------------
// CrossReferenceSchema
// --------------------------------------------------------

describe('CrossReferenceSchema', () => {
  const validRef = {
    id: 'xref-001',
    sourceObjectId: 'obj-100',
    targetObjectId: 'obj-200',
    referenceType: 'cites' as const,
  };

  it('accepts a valid cross-reference', () => {
    const result = CrossReferenceSchema.safeParse(validRef);
    expect(result.success).toBe(true);
  });

  it('accepts all reference types', () => {
    for (const t of [
      'cites',
      'derived-from',
      'related-to',
      'supersedes',
      'contradicts',
      'abstracts',
    ]) {
      const result = CrossReferenceSchema.safeParse({ ...validRef, referenceType: t });
      expect(result.success).toBe(true);
    }
  });

  it('accepts without optional fields', () => {
    const result = CrossReferenceSchema.safeParse(validRef);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeUndefined();
      expect(result.data.createdAt).toBeUndefined();
    }
  });

  it('rejects empty id', () => {
    expect(CrossReferenceSchema.safeParse({ ...validRef, id: '' }).success).toBe(false);
  });

  it('rejects invalid referenceType', () => {
    expect(CrossReferenceSchema.safeParse({ ...validRef, referenceType: 'links-to' }).success).toBe(
      false
    );
  });
});

// --------------------------------------------------------
// Record-based Maps
// --------------------------------------------------------

describe('Record-based Maps', () => {
  it('DataObjectMapSchema accepts valid map', () => {
    const result = DataObjectMapSchema.safeParse({
      'obj-001': {
        objectId: 'obj-001',
        objectType: 'document',
        createdAt: '2026-03-08T10:00:00+09:00',
        updatedAt: '2026-03-08T10:00:00+09:00',
      },
    });
    expect(result.success).toBe(true);
  });

  it('EvidenceLinkMapSchema accepts valid map', () => {
    const result = EvidenceLinkMapSchema.safeParse({
      'el-001': {
        id: 'el-001',
        claimObjectId: 'obj-100',
        evidenceObjectId: 'obj-200',
        relationshipType: 'supports',
      },
    });
    expect(result.success).toBe(true);
  });

  it('TransformationEventMapSchema accepts valid map', () => {
    const result = TransformationEventMapSchema.safeParse({
      'te-001': {
        id: 'te-001',
        type: 'ocr',
        inputObjectIds: ['obj-100'],
        outputObjectIds: ['obj-101'],
        executedBy: 'system',
        executedAt: '2026-03-08T10:00:00+09:00',
      },
    });
    expect(result.success).toBe(true);
  });

  it('CrossReferenceMapSchema accepts valid map', () => {
    const result = CrossReferenceMapSchema.safeParse({
      'xref-001': {
        id: 'xref-001',
        sourceObjectId: 'obj-100',
        targetObjectId: 'obj-200',
        referenceType: 'cites',
      },
    });
    expect(result.success).toBe(true);
  });

  it('DataObjectMapSchema rejects invalid inner object', () => {
    const result = DataObjectMapSchema.safeParse({
      'obj-bad': { objectId: 'obj-bad' }, // missing objectType, createdAt, updatedAt
    });
    expect(result.success).toBe(false);
  });
});
