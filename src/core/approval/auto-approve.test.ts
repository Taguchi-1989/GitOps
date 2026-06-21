/**
 * FlowOps - Auto-Approval Tests (§5.1.1 / §5.3 Phase 2)
 *
 * 安全性最重要: 多重 fail-safe を網羅。誤って自動承認しないことを最優先で検証する。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  decideAutoApproval,
  tryAutoApprove,
  loadAutoApprovalConfig,
  DEFAULT_AUTO_APPROVAL_CONFIG,
  type AutoApprovalConfig,
} from './auto-approve';
import { Precedent } from './types';
import { auditLog } from '../audit';

const ENABLED: AutoApprovalConfig = {
  enabled: true,
  allowedGrades: ['low'],
  minPrecedents: 1,
  sampleAuditRate: 0,
};

function precedent(over: Partial<Precedent> = {}): Precedent {
  return {
    signature: 'sig',
    policyVersion: '1.0.0',
    riskGrade: 'low',
    approved: true,
    reason: 'ok',
    decidedBy: 'taguchi',
    decidedAt: new Date('2026-06-21'),
    ...over,
  };
}

const lowInput = { signature: 'sig', policyVersion: '1.0.0', riskGrade: 'low' as const };
const noSample = () => false;

describe('decideAutoApproval — 承認できる場合', () => {
  it('有効・low・同版の承認前例あり → 自動承認（auto-approved by precedent #N）', () => {
    const r = decideAutoApproval(lowInput, [precedent()], ENABLED, noSample);
    expect(r.autoApprove).toBe(true);
    expect(r.code).toBe('approved');
    expect(r.reason).toMatch(/auto-approved by precedent #1/);
  });
});

describe('decideAutoApproval — fail-safe（人手へ倒す）', () => {
  it('無効（既定 Phase 0）なら承認しない', () => {
    const r = decideAutoApproval(lowInput, [precedent()], DEFAULT_AUTO_APPROVAL_CONFIG, noSample);
    expect(r.autoApprove).toBe(false);
    expect(r.code).toBe('disabled');
  });

  it('許可外の等級（high）は承認しない', () => {
    const r = decideAutoApproval(
      { ...lowInput, riskGrade: 'high' },
      [precedent({ riskGrade: 'high' })],
      ENABLED,
      noSample
    );
    expect(r.autoApprove).toBe(false);
    expect(r.code).toBe('grade-not-allowed');
  });

  it('ポリシー版が不明なら承認しない', () => {
    const r = decideAutoApproval(
      { signature: 'sig', riskGrade: 'low' },
      [precedent()],
      ENABLED,
      noSample
    );
    expect(r.autoApprove).toBe(false);
    expect(r.code).toBe('policy-version-unknown');
  });

  it('前例のポリシー版が現行と不一致なら承認しない（今の版で過去を裁かない）', () => {
    const r = decideAutoApproval(
      lowInput,
      [precedent({ policyVersion: '0.9.0' })],
      ENABLED,
      noSample
    );
    expect(r.autoApprove).toBe(false);
    expect(r.code).toBe('insufficient-precedents');
  });

  it('前例が無ければ承認しない', () => {
    const r = decideAutoApproval(lowInput, [], ENABLED, noSample);
    expect(r.autoApprove).toBe(false);
    expect(r.code).toBe('insufficient-precedents');
  });

  it('却下前例が混在したら承認しない（合意が割れている）', () => {
    const r = decideAutoApproval(
      lowInput,
      [precedent(), precedent({ approved: false, reason: 'NG' })],
      ENABLED,
      noSample
    );
    expect(r.autoApprove).toBe(false);
    expect(r.code).toBe('conflicting-rejection');
  });

  it('minPrecedents 未満なら承認しない', () => {
    const r = decideAutoApproval(
      lowInput,
      [precedent()],
      { ...ENABLED, minPrecedents: 2 },
      noSample
    );
    expect(r.autoApprove).toBe(false);
    expect(r.code).toBe('insufficient-precedents');
  });
});

describe('loadAutoApprovalConfig', () => {
  const orig = { ...process.env };
  beforeEach(() => {
    process.env = { ...orig };
    delete process.env.APPROVAL_AUTO_APPROVE;
    delete process.env.APPROVAL_AUTO_GRADES;
  });

  it('既定は無効（Phase 0）', () => {
    expect(loadAutoApprovalConfig().enabled).toBe(false);
  });

  it('APPROVAL_AUTO_APPROVE=true で有効化、等級は env から', () => {
    process.env.APPROVAL_AUTO_APPROVE = 'true';
    process.env.APPROVAL_AUTO_GRADES = 'low,medium';
    const c = loadAutoApprovalConfig();
    expect(c.enabled).toBe(true);
    expect(c.allowedGrades).toEqual(['low', 'medium']);
  });
});

describe('tryAutoApprove (I/O)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('無効時は前例取得も監査もせず即 deny', async () => {
    const finder = vi.fn();
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const r = await tryAutoApprove(lowInput, {
      config: DEFAULT_AUTO_APPROVAL_CONFIG,
      precedentFinder: finder,
    });
    expect(r.autoApprove).toBe(false);
    expect(finder).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('自動承認時のみ AUTO_APPROVE を監査（policyVersion 付き）', async () => {
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const finder = vi.fn().mockResolvedValue([precedent()]);

    const r = await tryAutoApprove(lowInput, {
      config: ENABLED,
      precedentFinder: finder,
      sourceEntityId: 'prop-1',
    });

    expect(r.autoApprove).toBe(true);
    expect(finder).toHaveBeenCalledWith('sig', '1.0.0');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTO_APPROVE',
        entityId: 'precedent:sig',
        policyVersion: '1.0.0',
      })
    );
  });

  it('不承認時は監査しない（人手フローが記録する）', async () => {
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const finder = vi.fn().mockResolvedValue([]); // 前例なし
    const r = await tryAutoApprove(lowInput, { config: ENABLED, precedentFinder: finder });
    expect(r.autoApprove).toBe(false);
    expect(record).not.toHaveBeenCalled();
  });

  it('サンプル監査に選ばれた自動承認は厚層(thick)で残す', async () => {
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const finder = vi.fn().mockResolvedValue([precedent()]);
    // rate=1 で必ずサンプル対象
    await tryAutoApprove(lowInput, {
      config: { ...ENABLED, sampleAuditRate: 1 },
      precedentFinder: finder,
    });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ severity: 'thick' }));
  });

  it('前例が取得上限に達したら fail-safe で人手へ（conflict-safety: 却下取りこぼし防止）', async () => {
    vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    // 上限(1000)件すべて承認でも、全件確認を保証できないため deny
    const many = Array.from({ length: 1000 }, () => precedent());
    const finder = vi.fn().mockResolvedValue(many);
    const r = await tryAutoApprove(lowInput, { config: ENABLED, precedentFinder: finder });
    expect(r.autoApprove).toBe(false);
    expect(r.code).toBe('precedent-overflow');
  });

  it('監査記録に失敗したら自動承認扱いにしない（証跡なき承認を作らない）', async () => {
    vi.spyOn(auditLog, 'record').mockRejectedValue(new Error('db down'));
    const finder = vi.fn().mockResolvedValue([precedent()]);
    const r = await tryAutoApprove(lowInput, { config: ENABLED, precedentFinder: finder });
    expect(r.autoApprove).toBe(false);
    expect(r.code).toBe('audit-write-failed');
  });
});
