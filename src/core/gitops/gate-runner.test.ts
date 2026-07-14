/**
 * FlowOps - GitOps Gate Runner Tests (第II部 §11 / GIT-1)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGovernanceGate } from './gate-runner';
import { auditLog } from '../audit';
import { GitContext } from './types';

const git: GitContext = {
  commitSha: 'abc1234',
  prNumber: 42,
  branch: 'feature/x',
  repo: 'o/r',
  actor: 'taguchi',
};

describe('runGovernanceGate', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('検出なしは allow、GITOPS_GATE を commit SHA に紐づけ監査（GIT-1）', async () => {
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const r = await runGovernanceGate({
      git,
      diffText: '+ 在庫を補充する手順を追加',
      riskGrade: 'low',
    });

    expect(r.action).toBe('allow');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'GITOPS_GATE',
        entityId: 'abc1234', // commit SHA に紐づく
        severity: 'thin',
      })
    );
    // PR 番号も payload に紐づく
    const payload = record.mock.calls[0][0].payload as Record<string, unknown>;
    expect(payload.prNumber).toBe(42);
  });

  it('差分に値型機密が入れば block（full 層で監査）', async () => {
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const r = await runGovernanceGate({
      git,
      diffText: '+ AWS_KEY=AKIAIOSFODNN7EXAMPLE',
    });
    expect(r.action).toBe('block');
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ severity: 'full' }));
  });

  it('Git差分専用ポリシーはコード上の変数代入を秘密値と誤認しない', async () => {
    vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const r = await runGovernanceGate({
      git,
      diffText: '+ const apiKey = provider.apiKey;',
      ingressPolicyId: 'gitops-secret-gate',
      riskGrade: 'low',
    });

    expect(r.action).toBe('allow');
    expect(r.ingress?.decision).toBe('pass');
  });

  it('Git差分専用ポリシーでも既知形式の秘密値は block する', async () => {
    vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const r = await runGovernanceGate({
      git,
      diffText: '+ AWS_KEY=AKIAIOSFODNN7EXAMPLE',
      ingressPolicyId: 'gitops-secret-gate',
      riskGrade: 'low',
    });

    expect(r.action).toBe('block');
  });

  it('出口成果物に既知危険があれば block', async () => {
    vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const r = await runGovernanceGate({
      git,
      artifact: { intent: 'x', patches: [{ value: 'rm -rf /var/data' }] },
    });
    expect(r.action).toBe('block');
    expect(r.egress?.decision).toBe('block');
  });

  it('リスク等級 high は escalate（thick）', async () => {
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const r = await runGovernanceGate({ git, diffText: '+ 普通の変更', riskGrade: 'high' });
    expect(r.action).toBe('escalate');
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ severity: 'thick' }));
  });

  it('結合型機密(email)は escalate（mask→要確認）', async () => {
    vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const r = await runGovernanceGate({ git, diffText: '+ 連絡先 a@b.com', riskGrade: 'low' });
    expect(r.action).toBe('escalate');
    expect(r.ingress?.decision).toBe('mask');
  });

  it('大きな複数行差分は行境界で分割して検査する', async () => {
    vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const largeSafeDiff = '+ 通常の変更\n'.repeat(20_000);
    const r = await runGovernanceGate({
      git,
      diffText: largeSafeDiff,
      artifact: largeSafeDiff,
      riskGrade: 'low',
    });

    expect(largeSafeDiff.length).toBeGreaterThan(100_000);
    expect(r.action).toBe('allow');
    expect(r.ingress?.decision).toBe('pass');
    expect(r.egress?.decision).toBe('pass');
  });

  it('分割後の後続チャンクにある機密も検出する', async () => {
    vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const largeDiff = `${'+ 通常の変更\n'.repeat(12_000)}+ AWS_KEY=AKIAIOSFODNN7EXAMPLE`;
    const r = await runGovernanceGate({ git, diffText: largeDiff, riskGrade: 'low' });

    expect(r.action).toBe('block');
    expect(r.ingress?.decision).toBe('block');
  });

  it('巨大な単一行は分割せず fail-safe で block する', async () => {
    vi.spyOn(auditLog, 'record').mockResolvedValue(null);
    const r = await runGovernanceGate({
      git,
      diffText: `+ ${'x'.repeat(100_001)}`,
      riskGrade: 'low',
    });

    expect(r.action).toBe('block');
    expect(r.ingress?.decision).toBe('block');
  });
});
