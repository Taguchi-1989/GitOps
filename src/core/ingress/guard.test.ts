/**
 * FlowOps - Ingress Guard Tests (§4.1 を呼び出し境界へ適用 + 監査)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { guardIngress, IngressBlockedError } from './guard';
import { DEFAULT_INGRESS_POLICY } from './policy-loader';
import { auditLog } from '../audit';

describe('guardIngress', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('機密なしは pass: フィールドを変えずに返し、INGRESS_GATE を thin で監査', async () => {
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);

    const { fields, evaluation } = await guardIngress(
      { issueTitle: '在庫補充', issueDescription: '毎朝チェックする' },
      { entityId: 'issue-1', policy: DEFAULT_INGRESS_POLICY }
    );

    expect(evaluation.decision).toBe('pass');
    expect(fields.issueTitle).toBe('在庫補充');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INGRESS_GATE',
        entityId: 'issue-1',
        severity: 'thin',
        policyVersion: '1.0.0',
      })
    );
  });

  it('結合型は mask: 伏字化フィールドを返し、監査payloadに実体を載せない', async () => {
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);

    const { fields, evaluation } = await guardIngress(
      { issueDescription: '担当者 taro@example.com に確認' },
      { entityId: 'issue-2', policy: DEFAULT_INGRESS_POLICY }
    );

    expect(evaluation.decision).toBe('mask');
    expect(fields.issueDescription).toContain('«REDACTED:email»');
    expect(fields.issueDescription).not.toContain('taro@example.com');

    const payload = record.mock.calls[0][0].payload as Record<string, unknown>;
    // 監査は件数・パターンidのみ。生メールを含まない（LOG-1）
    expect(JSON.stringify(payload)).not.toContain('taro@example.com');
    expect(payload.decision).toBe('mask');
  });

  it('値型は block: IngressBlockedError を送出し、その前に full で監査', async () => {
    const record = vi.spyOn(auditLog, 'record').mockResolvedValue(null);

    await expect(
      guardIngress(
        { flowYaml: 'token: AKIAIOSFODNN7EXAMPLE' },
        { entityId: 'issue-3', policy: DEFAULT_INGRESS_POLICY }
      )
    ).rejects.toBeInstanceOf(IngressBlockedError);

    // 監査は block 送出より前に必ず記録される（配管最優先）
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INGRESS_GATE', entityId: 'issue-3', severity: 'full' })
    );
  });

  it('複数フィールドのうち最も重い判定を全体判定とする', async () => {
    vi.spyOn(auditLog, 'record').mockResolvedValue(null);

    await expect(
      guardIngress(
        { issueTitle: '普通のタイトル', flowYaml: 'k: AKIAIOSFODNN7EXAMPLE' },
        { entityId: 'issue-4', policy: DEFAULT_INGRESS_POLICY }
      )
    ).rejects.toBeInstanceOf(IngressBlockedError);
  });
});
