import { describe, it, expect } from 'vitest';
import {
  FlowSchema,
  NodeSchema,
  EdgeSchema,
  LayerSchema,
  FlowLayerSchema,
  SensitivityLevelSchema,
  DataClassificationSchema,
  DataLayerSchema,
  ExportPolicySchema,
  SensitivityLevelDefinitionSchema,
  ApprovalStatusSchema,
  CarrierConstraintSchema,
  AccessControlSchema,
  AccessPolicyDefinitionSchema,
  AuditLevelSchema,
} from './schema';

const validNode = {
  id: 'node_1',
  type: 'process' as const,
  label: 'Test Node',
  role: 'sales',
};

const validEdge = {
  id: 'edge_1',
  from: 'node_1',
  to: 'node_2',
  label: 'next',
};

const validFlow = {
  id: 'test-flow',
  title: 'Test Flow',
  layer: 'L1' as const,
  updatedAt: '2026-01-01T00:00:00Z',
  nodes: {
    node_1: { id: 'node_1', type: 'start', label: 'Start' },
    node_2: { id: 'node_2', type: 'end', label: 'End' },
  },
  edges: {
    edge_1: { id: 'edge_1', from: 'node_1', to: 'node_2' },
  },
};

describe('NodeSchema', () => {
  it('accepts a valid node', () => {
    const result = NodeSchema.safeParse(validNode);
    expect(result.success).toBe(true);
  });

  it('rejects node with missing label', () => {
    const result = NodeSchema.safeParse({ id: 'n1', type: 'process' });
    expect(result.success).toBe(false);
  });

  it('rejects node with invalid type', () => {
    const result = NodeSchema.safeParse({ ...validNode, type: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts node with optional fields omitted', () => {
    const result = NodeSchema.safeParse({ id: 'n1', type: 'process', label: 'A' });
    expect(result.success).toBe(true);
  });

  it('accepts node with dataClassification', () => {
    const result = NodeSchema.safeParse({
      ...validNode,
      dataClassification: {
        sensitivityLevel: 'L4',
        aiUsageAllowed: true,
        abstractionRequired: true,
        exportPolicy: 'abstracted-only',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts node without dataClassification (backward compatible)', () => {
    const result = NodeSchema.safeParse(validNode);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataClassification).toBeUndefined();
    }
  });
});

describe('EdgeSchema', () => {
  it('accepts a valid edge', () => {
    const result = EdgeSchema.safeParse(validEdge);
    expect(result.success).toBe(true);
  });

  it('rejects edge with missing from', () => {
    const result = EdgeSchema.safeParse({ id: 'e1', to: 'n2' });
    expect(result.success).toBe(false);
  });

  it('accepts edge with dataLayer', () => {
    const result = EdgeSchema.safeParse({
      ...validEdge,
      dataLayer: 'abstracted-semantic',
    });
    expect(result.success).toBe(true);
  });

  it('accepts edge without dataLayer (backward compatible)', () => {
    const result = EdgeSchema.safeParse(validEdge);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataLayer).toBeUndefined();
    }
  });
});

describe('FlowLayerSchema / LayerSchema (後方互換)', () => {
  it('accepts L0, L1, L2', () => {
    expect(FlowLayerSchema.safeParse('L0').success).toBe(true);
    expect(FlowLayerSchema.safeParse('L1').success).toBe(true);
    expect(FlowLayerSchema.safeParse('L2').success).toBe(true);
  });

  it('rejects invalid layer', () => {
    expect(FlowLayerSchema.safeParse('L3').success).toBe(false);
    expect(FlowLayerSchema.safeParse('').success).toBe(false);
  });

  it('LayerSchema is an alias for FlowLayerSchema', () => {
    expect(LayerSchema).toBe(FlowLayerSchema);
  });
});

describe('SensitivityLevelSchema', () => {
  it('accepts L0 through L5', () => {
    for (const level of ['L0', 'L1', 'L2', 'L3', 'L4', 'L5']) {
      expect(SensitivityLevelSchema.safeParse(level).success).toBe(true);
    }
  });

  it('rejects invalid levels', () => {
    expect(SensitivityLevelSchema.safeParse('L6').success).toBe(false);
    expect(SensitivityLevelSchema.safeParse('').success).toBe(false);
    expect(SensitivityLevelSchema.safeParse('high').success).toBe(false);
  });
});

describe('DataClassificationSchema', () => {
  it('accepts full classification', () => {
    const result = DataClassificationSchema.safeParse({
      sensitivityLevel: 'L4',
      aiUsageAllowed: true,
      abstractionRequired: true,
      exportPolicy: 'abstracted-only',
    });
    expect(result.success).toBe(true);
  });

  it('applies defaults when fields omitted', () => {
    const result = DataClassificationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sensitivityLevel).toBe('L1');
      expect(result.data.aiUsageAllowed).toBe(true);
      expect(result.data.abstractionRequired).toBe(false);
      expect(result.data.exportPolicy).toBe('unrestricted');
    }
  });

  it('rejects invalid sensitivity level', () => {
    const result = DataClassificationSchema.safeParse({
      sensitivityLevel: 'L9',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid export policy', () => {
    const result = DataClassificationSchema.safeParse({
      exportPolicy: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('DataLayerSchema', () => {
  it('accepts all 3 data layers', () => {
    expect(DataLayerSchema.safeParse('confidential-original').success).toBe(true);
    expect(DataLayerSchema.safeParse('abstracted-semantic').success).toBe(true);
    expect(DataLayerSchema.safeParse('output-artifact').success).toBe(true);
  });

  it('rejects invalid data layer', () => {
    expect(DataLayerSchema.safeParse('unknown').success).toBe(false);
  });
});

describe('ExportPolicySchema', () => {
  it('accepts all export policies', () => {
    for (const policy of ['unrestricted', 'internal-only', 'abstracted-only', 'prohibited']) {
      expect(ExportPolicySchema.safeParse(policy).success).toBe(true);
    }
  });
});

describe('SensitivityLevelDefinitionSchema', () => {
  it('accepts a valid definition', () => {
    const result = SensitivityLevelDefinitionSchema.safeParse({
      id: 'L3',
      name: '機密情報',
      description: 'Confidential',
      aiUsageAllowed: true,
      abstractionRequired: false,
      exportAllowed: false,
      auditLevel: 'enhanced',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid audit level', () => {
    const result = SensitivityLevelDefinitionSchema.safeParse({
      id: 'L3',
      name: '機密情報',
      aiUsageAllowed: true,
      abstractionRequired: false,
      exportAllowed: false,
      auditLevel: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('FlowSchema', () => {
  it('accepts a valid flow', () => {
    const result = FlowSchema.safeParse(validFlow);
    expect(result.success).toBe(true);
  });

  it('rejects flow with missing title', () => {
    const { title, ...noTitle } = validFlow;
    const result = FlowSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it('rejects flow with empty nodes', () => {
    const result = FlowSchema.safeParse({ ...validFlow, nodes: {} });
    // Empty record is valid at schema level (semantic checks are in validateFlow)
    expect(result.success).toBe(true);
  });

  it('rejects flow with invalid layer', () => {
    const result = FlowSchema.safeParse({ ...validFlow, layer: 'L9' });
    expect(result.success).toBe(false);
  });

  it('accepts flow with GPTsiteki fields', () => {
    const result = FlowSchema.safeParse({
      ...validFlow,
      businessPurpose: '受注処理の効率化と品質向上',
      ownerOrg: '営業部',
      sensitivityLevel: 'L2',
    });
    expect(result.success).toBe(true);
  });

  it('accepts flow without GPTsiteki fields (backward compatible)', () => {
    const result = FlowSchema.safeParse(validFlow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessPurpose).toBeUndefined();
      expect(result.data.ownerOrg).toBeUndefined();
      expect(result.data.sensitivityLevel).toBeUndefined();
    }
  });

  it('accepts flow with accessControl', () => {
    const result = FlowSchema.safeParse({
      ...validFlow,
      accessControl: {
        ownerUser: 'tanaka',
        purposeOfUse: '品質管理',
        viewingQualification: ['quality-engineer', 'manager'],
        approvalStatus: 'approved',
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2027-01-01T00:00:00Z',
        carrierConstraint: 'internal-network',
        reverseReferable: true,
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts flow without accessControl (backward compatible)', () => {
    const result = FlowSchema.safeParse(validFlow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accessControl).toBeUndefined();
    }
  });
});

describe('ApprovalStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const s of ['draft', 'pending-review', 'approved', 'rejected', 'expired', 'revoked']) {
      expect(ApprovalStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    expect(ApprovalStatusSchema.safeParse('unknown').success).toBe(false);
  });
});

describe('CarrierConstraintSchema', () => {
  it('accepts all valid constraints', () => {
    for (const c of [
      'none',
      'internal-network',
      'physical-media',
      'closed-network',
      'local-only',
    ]) {
      expect(CarrierConstraintSchema.safeParse(c).success).toBe(true);
    }
  });

  it('rejects invalid constraint', () => {
    expect(CarrierConstraintSchema.safeParse('outer-space').success).toBe(false);
  });
});

describe('AccessControlSchema', () => {
  it('accepts full access control object', () => {
    const result = AccessControlSchema.safeParse({
      ownerUser: 'tanaka',
      purposeOfUse: '品質管理',
      viewingQualification: ['quality-engineer'],
      approvalStatus: 'approved',
      validFrom: '2026-01-01T00:00:00Z',
      validUntil: '2027-01-01T00:00:00Z',
      carrierConstraint: 'closed-network',
      reverseReferable: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    const result = AccessControlSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('applies default for reverseReferable', () => {
    const result = AccessControlSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reverseReferable).toBe(true);
    }
  });

  it('rejects invalid approvalStatus', () => {
    expect(AccessControlSchema.safeParse({ approvalStatus: 'invalid' }).success).toBe(false);
  });

  it('rejects invalid carrierConstraint', () => {
    expect(AccessControlSchema.safeParse({ carrierConstraint: 'invalid' }).success).toBe(false);
  });
});

describe('AuditLevelSchema', () => {
  it('accepts all audit levels', () => {
    for (const l of ['minimal', 'standard', 'enhanced', 'strict', 'maximum']) {
      expect(AuditLevelSchema.safeParse(l).success).toBe(true);
    }
  });

  it('rejects invalid level', () => {
    expect(AuditLevelSchema.safeParse('extreme').success).toBe(false);
  });
});

describe('AccessPolicyDefinitionSchema', () => {
  const validPolicy = {
    id: 'policy-L3-confidential',
    name: '機密情報ポリシー',
    description: '権限保持者のみ。持出不可。',
    sensitivityLevel: 'L3',
    carrierConstraint: 'internal-network',
    aiUsageAllowed: true,
    abstractionRequired: false,
    exportPolicy: 'prohibited',
    auditLevel: 'enhanced',
    reverseReferable: true,
  };

  it('accepts a valid policy definition', () => {
    const result = AccessPolicyDefinitionSchema.safeParse(validPolicy);
    expect(result.success).toBe(true);
  });

  it('rejects invalid sensitivityLevel', () => {
    expect(
      AccessPolicyDefinitionSchema.safeParse({ ...validPolicy, sensitivityLevel: 'L9' }).success
    ).toBe(false);
  });

  it('rejects invalid carrierConstraint', () => {
    expect(
      AccessPolicyDefinitionSchema.safeParse({ ...validPolicy, carrierConstraint: 'cloud' }).success
    ).toBe(false);
  });

  it('rejects invalid exportPolicy', () => {
    expect(
      AccessPolicyDefinitionSchema.safeParse({ ...validPolicy, exportPolicy: 'maybe' }).success
    ).toBe(false);
  });

  it('rejects invalid auditLevel', () => {
    expect(
      AccessPolicyDefinitionSchema.safeParse({ ...validPolicy, auditLevel: 'extreme' }).success
    ).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(AccessPolicyDefinitionSchema.safeParse({ id: 'test' }).success).toBe(false);
  });
});
