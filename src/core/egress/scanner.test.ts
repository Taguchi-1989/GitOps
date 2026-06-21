/**
 * FlowOps - Egress Scanner Tests (ガバナンス・ハーネス §4.2)
 */

import { describe, it, expect } from 'vitest';
import { scanEgress, EGRESS_MAX_VALUE_LENGTH } from './scanner';

const cleanProposal = {
  intent: 'ラベルを更新する',
  patches: [{ op: 'replace', path: '/nodes/n1/label', value: '新ラベル' }],
};

describe('scanEgress', () => {
  it('健全な出力は pass（thin）', () => {
    const r = scanEgress(cleanProposal);
    expect(r.decision).toBe('pass');
    expect(r.tier).toBe('thin');
    expect(r.findings).toHaveLength(0);
  });

  it('出力に混入した秘密(AWSキー)は block（二重化トリップ・full）', () => {
    const r = scanEgress({
      intent: 'set key',
      patches: [{ op: 'add', path: '/x', value: 'AKIAIOSFODNN7EXAMPLE' }],
    });
    expect(r.decision).toBe('block');
    expect(r.tier).toBe('full');
    expect(r.findings.some(f => f.category === 'secret')).toBe(true);
    // field 経路が記録される（実体ではない）
    expect(r.findings[0].field).toContain('patches');
  });

  it('破壊的コマンド片(rm -rf /)は block（command-injection）', () => {
    const r = scanEgress({ intent: 'run rm -rf /tmp/data', patches: [] });
    expect(r.decision).toBe('block');
    expect(r.findings.some(f => f.category === 'command-injection')).toBe(true);
  });

  it('スクリプト注入(<script>)は block', () => {
    const r = scanEgress({ intent: 'x', patches: [{ value: '<script>alert(1)</script>' }] });
    expect(r.decision).toBe('block');
    expect(r.findings.some(f => f.category === 'script-injection')).toBe(true);
  });

  it('平文httpのURLは medium → flag（通すが要レビュー・thick）', () => {
    const r = scanEgress({ intent: 'see http://example.com/doc', patches: [] });
    expect(r.decision).toBe('flag');
    expect(r.tier).toBe('thick');
    expect(r.findings.some(f => f.category === 'suspicious-url')).toBe(true);
  });

  it('high と medium が混在したら block が優先', () => {
    const r = scanEgress({
      intent: 'http://example.com',
      patches: [{ value: 'AKIAIOSFODNN7EXAMPLE' }],
    });
    expect(r.decision).toBe('block');
  });

  it('過大リーフは走査せず high として block（fail-safe）', () => {
    const r = scanEgress({ intent: 'x'.repeat(EGRESS_MAX_VALUE_LENGTH + 1), patches: [] });
    expect(r.decision).toBe('block');
    expect(r.findings.some(f => f.ruleId === '__length_exceeded__')).toBe(true);
  });

  it('決定論（同一入力で同一結果）', () => {
    const out = { intent: 'AKIAIOSFODNN7EXAMPLE と http://a.b', patches: [] };
    expect(scanEgress(out)).toEqual(scanEgress(out));
  });
});
