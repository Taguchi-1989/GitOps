/**
 * FlowOps - Egress Guard Tests (§4.2 + 監査)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { guardEgress, EgressBlockedError } from './guard';
import { auditLog } from '../audit';

describe('guardEgress', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('健全な出力は pass: EGRESS_GATE を thin で監査', async () => {
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);

    const evald = await guardEgress({ intent: 'ラベル更新', patches: [] }, { entityId: 'prop-1' });

    expect(evald.decision).toBe('pass');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EGRESS_GATE', entityId: 'prop-1', severity: 'thin' })
    );
  });

  it('秘密混入は block: EgressBlockedError、監査payloadに実体を載せない', async () => {
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);

    await expect(
      guardEgress(
        { intent: 'x', patches: [{ value: 'AKIAIOSFODNN7EXAMPLE' }] },
        { entityId: 'prop-2' }
      )
    ).rejects.toBeInstanceOf(EgressBlockedError);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EGRESS_GATE', entityId: 'prop-2', severity: 'full' })
    );
    const payload = record.mock.calls[0][0].payload as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('medium のみは flag: 監査 thick で通す（throwしない）', async () => {
    vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const evald = await guardEgress({ intent: 'see http://example.com', patches: [] });
    expect(evald.decision).toBe('flag');
    expect(evald.tier).toBe('thick');
  });
});
