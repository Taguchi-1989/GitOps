/**
 * FlowOps - Case Signature Tests (§5.1.1)
 */

import { describe, it, expect } from 'vitest';
import { caseSignature, signatureFromContext } from './case-signature';

describe('caseSignature', () => {
  it('同じ特徴は同じシグネチャ（キー順非依存・決定論）', () => {
    expect(caseSignature({ a: 1, b: 'x' })).toBe(caseSignature({ b: 'x', a: 1 }));
  });

  it('特徴が違えば異なるシグネチャ', () => {
    expect(caseSignature({ kind: 'low' })).not.toBe(caseSignature({ kind: 'high' }));
  });

  it('空でも安定したシグネチャを返す（空文字にしない）', () => {
    expect(caseSignature({})).toBe(caseSignature({}));
    expect(caseSignature({}).length).toBeGreaterThan(0);
  });
});

describe('signatureFromContext', () => {
  it('caseFeatures があればそれだけで同定（可変フィールドの影響を受けない）', () => {
    const a = signatureFromContext({
      caseFeatures: { taskId: 't1', risk: 'low' },
      decidedAt: '2026-01-01',
    });
    const b = signatureFromContext({
      caseFeatures: { taskId: 't1', risk: 'low' },
      decidedAt: '2026-06-21', // 可変フィールドが違っても同一
    });
    expect(a).toBe(b);
  });

  it('caseFeatures が無ければ context 全体を用いる', () => {
    expect(signatureFromContext({ taskId: 't1' })).toBe(caseSignature({ taskId: 't1' }));
  });
});
