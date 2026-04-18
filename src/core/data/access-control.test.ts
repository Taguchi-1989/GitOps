import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/core/audit/logger', () => ({
  auditLog: {
    logDataAction: vi.fn(),
  },
}));

import { AccessControlService } from './access-control';
import type { AccessActor } from './access-control';
import type { DataObject } from './schemas';
import type { SensitivityLevelConfig, AccessPolicyConfig } from './policy-loader';

// テスト用のポリシー設定
const testLevels: Record<string, SensitivityLevelConfig> = {
  L0: {
    id: 'L0',
    name: '公開',
    aiUsageAllowed: true,
    abstractionRequired: false,
    exportAllowed: true,
    auditLevel: 'minimal',
  },
  L1: {
    id: 'L1',
    name: '社内一般',
    aiUsageAllowed: true,
    abstractionRequired: false,
    exportAllowed: true,
    auditLevel: 'standard',
  },
  L2: {
    id: 'L2',
    name: '部門限定',
    aiUsageAllowed: true,
    abstractionRequired: false,
    exportAllowed: true,
    auditLevel: 'standard',
  },
  L3: {
    id: 'L3',
    name: '機密',
    aiUsageAllowed: true,
    abstractionRequired: false,
    exportAllowed: false,
    auditLevel: 'enhanced',
  },
  L4: {
    id: 'L4',
    name: '高機密',
    aiUsageAllowed: true,
    abstractionRequired: true,
    exportAllowed: false,
    auditLevel: 'strict',
  },
  L5: {
    id: 'L5',
    name: '極秘',
    aiUsageAllowed: false,
    abstractionRequired: true,
    exportAllowed: false,
    auditLevel: 'maximum',
  },
};

const testPolicies: Record<string, AccessPolicyConfig> = {
  'policy-L5-top-secret': {
    id: 'policy-L5-top-secret',
    name: '極秘ポリシー',
    sensitivityLevel: 'L5',
    carrierConstraint: 'local-only',
    aiUsageAllowed: false,
    abstractionRequired: true,
    exportPolicy: 'prohibited',
    auditLevel: 'maximum',
    reverseReferable: false,
  },
  'policy-L3-confidential': {
    id: 'policy-L3-confidential',
    name: '機密ポリシー',
    sensitivityLevel: 'L3',
    carrierConstraint: 'internal-network',
    aiUsageAllowed: true,
    abstractionRequired: false,
    exportPolicy: 'prohibited',
    auditLevel: 'enhanced',
    reverseReferable: true,
  },
};

function makeDataObject(overrides: Partial<DataObject> = {}): DataObject {
  return {
    objectId: 'obj-test-001',
    objectType: 'document',
    sensitivityLevel: 'L1',
    exportPolicy: 'unrestricted',
    createdAt: '2026-03-09T10:00:00+09:00',
    updatedAt: '2026-03-09T10:00:00+09:00',
    ...overrides,
  };
}

function makeActor(overrides: Partial<AccessActor> = {}): AccessActor {
  return {
    id: 'actor-001',
    roles: ['engineer'],
    clearanceLevel: 'L3',
    ...overrides,
  };
}

describe('AccessControlService', () => {
  let service: AccessControlService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccessControlService();
    service.setConfig(testLevels, testPolicies);
  });

  describe('clearance level check', () => {
    it('should allow access when clearance >= data level', async () => {
      const result = await service.checkAccess(
        makeActor({ clearanceLevel: 'L3' }),
        makeDataObject({ sensitivityLevel: 'L2' }),
        'read'
      );
      expect(result.allowed).toBe(true);
    });

    it('should allow access when clearance == data level', async () => {
      const result = await service.checkAccess(
        makeActor({ clearanceLevel: 'L3' }),
        makeDataObject({ sensitivityLevel: 'L3' }),
        'read'
      );
      expect(result.allowed).toBe(true);
    });

    it('should deny access when clearance < data level', async () => {
      const result = await service.checkAccess(
        makeActor({ clearanceLevel: 'L2' }),
        makeDataObject({ sensitivityLevel: 'L3' }),
        'read'
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('clearance');
    });

    it('should deny L0 actor from L5 data', async () => {
      const result = await service.checkAccess(
        makeActor({ clearanceLevel: 'L0' }),
        makeDataObject({ sensitivityLevel: 'L5' }),
        'read'
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe('ai-usage action', () => {
    it('should allow AI usage for L0-L4', async () => {
      for (const level of ['L0', 'L1', 'L2', 'L3', 'L4'] as const) {
        const result = await service.checkAccess(
          makeActor({ clearanceLevel: 'L5' }),
          makeDataObject({ sensitivityLevel: level }),
          'ai-usage'
        );
        expect(result.allowed).toBe(true);
      }
    });

    it('should deny AI usage for L5', async () => {
      const result = await service.checkAccess(
        makeActor({ clearanceLevel: 'L5' }),
        makeDataObject({ sensitivityLevel: 'L5' }),
        'ai-usage'
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('AI usage');
    });
  });

  describe('export action', () => {
    it('should allow export for L0-L2', async () => {
      for (const level of ['L0', 'L1', 'L2'] as const) {
        const result = await service.checkAccess(
          makeActor({ clearanceLevel: 'L5' }),
          makeDataObject({ sensitivityLevel: level }),
          'export'
        );
        expect(result.allowed).toBe(true);
      }
    });

    it('should deny export for L3-L5', async () => {
      for (const level of ['L3', 'L4', 'L5'] as const) {
        const result = await service.checkAccess(
          makeActor({ clearanceLevel: 'L5' }),
          makeDataObject({ sensitivityLevel: level }),
          'export'
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Export');
      }
    });
  });

  describe('abstraction requirement', () => {
    it('should not require abstraction for L0-L3', async () => {
      for (const level of ['L0', 'L1', 'L2', 'L3'] as const) {
        const result = await service.checkAccess(
          makeActor({ clearanceLevel: 'L5' }),
          makeDataObject({ sensitivityLevel: level }),
          'read'
        );
        expect(result.requiresAbstraction).toBe(false);
      }
    });

    it('should require abstraction for L4', async () => {
      const result = await service.checkAccess(
        makeActor({ clearanceLevel: 'L5' }),
        makeDataObject({ sensitivityLevel: 'L4' }),
        'read'
      );
      expect(result.allowed).toBe(true);
      expect(result.requiresAbstraction).toBe(true);
    });
  });

  describe('audit level', () => {
    it('should return correct audit level per sensitivity', async () => {
      const result0 = await service.checkAccess(
        makeActor({ clearanceLevel: 'L5' }),
        makeDataObject({ sensitivityLevel: 'L0' }),
        'read'
      );
      expect(result0.auditLevel).toBe('minimal');

      const result3 = await service.checkAccess(
        makeActor({ clearanceLevel: 'L5' }),
        makeDataObject({ sensitivityLevel: 'L3' }),
        'read'
      );
      expect(result3.auditLevel).toBe('enhanced');

      const result5 = await service.checkAccess(
        makeActor({ clearanceLevel: 'L5' }),
        makeDataObject({ sensitivityLevel: 'L5' }),
        'read'
      );
      expect(result5.auditLevel).toBe('maximum');
    });
  });

  describe('access policy override', () => {
    it('should deny AI usage when policy prohibits it', async () => {
      const result = await service.checkAccess(
        makeActor({ clearanceLevel: 'L5' }),
        makeDataObject({
          sensitivityLevel: 'L3',
          accessPolicyRef: 'policy-L5-top-secret',
        }),
        'ai-usage'
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Policy');
    });

    it('should deny export when policy prohibits it', async () => {
      const result = await service.checkAccess(
        makeActor({ clearanceLevel: 'L5' }),
        makeDataObject({
          sensitivityLevel: 'L1',
          accessPolicyRef: 'policy-L3-confidential',
        }),
        'export'
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Policy');
    });

    it('should ignore unknown policy ref gracefully', async () => {
      const result = await service.checkAccess(
        makeActor({ clearanceLevel: 'L5' }),
        makeDataObject({
          sensitivityLevel: 'L1',
          accessPolicyRef: 'nonexistent-policy',
        }),
        'read'
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('getPolicy / getSensitivityLevel', () => {
    it('should return policy by id', () => {
      const policy = service.getPolicy('policy-L5-top-secret');
      expect(policy).toBeDefined();
      expect(policy!.aiUsageAllowed).toBe(false);
    });

    it('should return undefined for unknown policy', () => {
      expect(service.getPolicy('nonexistent')).toBeUndefined();
    });

    it('should return sensitivity level config', () => {
      const config = service.getSensitivityLevel('L4');
      expect(config).toBeDefined();
      expect(config!.abstractionRequired).toBe(true);
    });
  });
});
