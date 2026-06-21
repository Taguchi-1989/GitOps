/**
 * FlowOps - Ingress Scanner Tests (ガバナンス・ハーネス §4.1)
 *
 * 決定論・fail-safe・マスキングの検証。
 */

import { describe, it, expect } from 'vitest';
import { scanIngress } from './scanner';
import { DEFAULT_INGRESS_POLICY } from './policy-loader';
import { IngressPolicy } from './types';

describe('scanIngress (default policy)', () => {
  it('機密が無ければ pass（thin）', () => {
    const r = scanIngress('このフローは在庫を補充する手順です', DEFAULT_INGRESS_POLICY);
    expect(r.decision).toBe('pass');
    expect(r.tier).toBe('thin');
    expect(r.detections).toHaveLength(0);
  });

  it('結合型(メール)は mask して素通し（thin）', () => {
    const r = scanIngress('連絡先は taro@example.com です', DEFAULT_INGRESS_POLICY);
    expect(r.decision).toBe('mask');
    expect(r.tier).toBe('thin');
    expect(r.maskedText).toContain('«REDACTED:email»');
    expect(r.maskedText).not.toContain('taro@example.com');
    expect(r.maskedCount).toBe(1);
  });

  it('値型(AWSキー)は block（full、実体はマスクしない）', () => {
    const r = scanIngress('key=AKIAIOSFODNN7EXAMPLE', DEFAULT_INGRESS_POLICY);
    expect(r.decision).toBe('block');
    expect(r.tier).toBe('full');
    // block では maskedText は元テキスト（外部送出しないので変換不要）
    expect(r.maskedText).toBe('key=AKIAIOSFODNN7EXAMPLE');
    expect(r.detections.some(d => d.classification === 'value')).toBe(true);
  });

  it('値型(PEM秘密鍵)は block', () => {
    const r = scanIngress(
      '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----',
      DEFAULT_INGRESS_POLICY
    );
    expect(r.decision).toBe('block');
    expect(r.tier).toBe('full');
  });

  it('値型と結合型が混在しても block が優先（最も重い判定）', () => {
    const r = scanIngress('mail a@b.co と AKIAIOSFODNN7EXAMPLE', DEFAULT_INGRESS_POLICY);
    expect(r.decision).toBe('block');
    expect(r.tier).toBe('full');
  });

  it('同一入力に同一結果（決定論・global状態を持ち越さない）', () => {
    const text = 'a@b.com c@d.com';
    const r1 = scanIngress(text, DEFAULT_INGRESS_POLICY);
    const r2 = scanIngress(text, DEFAULT_INGRESS_POLICY);
    expect(r1).toEqual(r2);
    expect(r1.maskedCount).toBe(2);
  });
});

describe('scanIngress (fail-safe / ING-2)', () => {
  const lowConfidencePolicy: IngressPolicy = {
    id: 'test',
    version: '0.0.1',
    title: 'test',
    confidenceThreshold: 0.8,
    failSafe: 'block',
    patterns: [
      {
        id: 'weak-token',
        kind: 'combination', // 本来マスク可だが…
        description: '弱い検出器',
        regex: 'TOKEN-[0-9]+',
        flags: '',
        confidence: 0.5, // しきい値0.8未満 → uncertain
      },
    ],
  };

  it('確信度がしきい値未満なら、結合型でも uncertain として block（安全側）', () => {
    const r = scanIngress('value TOKEN-12345', lowConfidencePolicy);
    expect(r.decision).toBe('block');
    expect(r.tier).toBe('thick'); // uncertain は エスカレーション層
    expect(r.detections[0].classification).toBe('uncertain');
    // 判定不能はマスクで素通しさせない（伏字化しない）
    expect(r.maskedText).toBe('value TOKEN-12345');
  });
});
