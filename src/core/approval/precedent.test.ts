/**
 * FlowOps - Precedent Store Tests (§5.1 / §5.3 Phase 0)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordPrecedent,
  findPrecedents,
  requiredApprovalLine,
  deriveRiskGrade,
} from './precedent';
import { auditLog } from '../audit';

describe('requiredApprovalLine (§5.1.2 決裁ライン)', () => {
  it('low→team-lead / medium→manager / high→executive', () => {
    expect(requiredApprovalLine('low')).toBe('team-lead');
    expect(requiredApprovalLine('medium')).toBe('manager');
    expect(requiredApprovalLine('high')).toBe('executive');
  });
});

describe('deriveRiskGrade', () => {
  it('明示があればそれ、無ければ medium（安全側）', () => {
    expect(deriveRiskGrade({ riskGrade: 'high' })).toBe('high');
    expect(deriveRiskGrade({})).toBe('medium');
    expect(deriveRiskGrade({ riskGrade: 'bogus' })).toBe('medium');
  });
});

describe('recordPrecedent', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('PRECEDENT_RECORD を entityId=precedent:<sig> / policyVersion 付きで監査する', async () => {
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);

    await recordPrecedent({
      signature: 'sig123',
      riskGrade: 'high',
      policyVersion: '1.0.0',
      approved: true,
      reason: 'ok',
      decidedBy: 'taguchi',
      sourceEntityId: 'wfe-1',
    });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRECEDENT_RECORD',
        entityId: 'precedent:sig123',
        policyVersion: '1.0.0',
        severity: 'thick', // high はエスカレーション層
      })
    );
  });
});

describe('findPrecedents', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('signature と policyVersion で照会し、payload を Precedent へ復元する', async () => {
    const decidedAt = new Date('2026-06-21');
    const query = vi.spyOn(auditLog, 'query').mockResolvedValue([
      {
        id: 'a1',
        actor: 'taguchi',
        action: 'PRECEDENT_RECORD',
        entityType: 'System',
        entityId: 'precedent:sig123',
        traceId: null,
        payload: JSON.stringify({
          riskGrade: 'low',
          approved: true,
          reason: '前例どおり',
          decidedBy: 'taguchi',
        }),
        policyVersion: '1.0.0',
        createdAt: decidedAt,
      } as never,
    ]);

    const result = await findPrecedents('sig123', '1.0.0');

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRECEDENT_RECORD',
        entityId: 'precedent:sig123',
        policyVersion: '1.0.0',
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      signature: 'sig123',
      policyVersion: '1.0.0',
      riskGrade: 'low',
      approved: true,
      reason: '前例どおり',
      decidedBy: 'taguchi',
      decidedAt,
    });
  });

  it('該当なしは空配列（Phase 0: ここから自動承認はしない）', async () => {
    vi.spyOn(auditLog, 'query').mockResolvedValue([]);
    expect(await findPrecedents('nope')).toEqual([]);
  });
});
