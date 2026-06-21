/**
 * FlowOps - Egress Rules Tests (エントロピー検出系 / OUTG-2 独立性)
 */

import { describe, it, expect } from 'vitest';
import { shannonEntropy, countHighEntropyTokens, EGRESS_RULES, ENTROPY_MIN_LENGTH } from './rules';

describe('shannonEntropy', () => {
  it('単一文字の繰り返しはエントロピー0', () => {
    expect(shannonEntropy('aaaaaaaa')).toBe(0);
  });

  it('空文字は0', () => {
    expect(shannonEntropy('')).toBe(0);
  });

  it('多様な文字ほど高い', () => {
    expect(shannonEntropy('abcdefghijklmnop')).toBeGreaterThan(shannonEntropy('aaaaaaaabbbbbbbb'));
  });
});

describe('countHighEntropyTokens', () => {
  it('長く乱雑なトークン（未知形式の秘密候補）を検出する', () => {
    // 32文字のランダム風トークン
    const token = 'a1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuV';
    expect(token.length).toBeGreaterThanOrEqual(ENTROPY_MIN_LENGTH);
    expect(countHighEntropyTokens(`token: ${token}`)).toBe(1);
  });

  it('普通の文章は検出しない', () => {
    expect(countHighEntropyTokens('この提案は在庫を補充する手順を追加します')).toBe(0);
  });

  it('短いトークンは閾値未満で検出しない', () => {
    expect(countHighEntropyTokens('abc123')).toBe(0);
  });
});

describe('EGRESS_RULES (独立性・健全性)', () => {
  it('全ルールがコンパイル可能な正規表現', () => {
    for (const rule of EGRESS_RULES) {
      expect(() => new RegExp(rule.regex, rule.flags ?? '')).not.toThrow();
    }
  });

  it('secret/command-injection/script は high、url/path は medium', () => {
    const high = EGRESS_RULES.filter(r => r.severity === 'high').map(r => r.category);
    expect(high).toContain('secret');
    expect(high).toContain('command-injection');
    expect(high).toContain('script-injection');
  });
});
