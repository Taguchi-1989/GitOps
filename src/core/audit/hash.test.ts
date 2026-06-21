/**
 * FlowOps - Audit Content Hashing Tests
 *
 * ガバナンス・ハーネス LOG-1/LOG-2/POL-2 の決定論性を検証する。
 */

import { describe, it, expect } from 'vitest';
import { stableStringify, sha256Hex, hashContent, hashPolicy } from './hash';

describe('stableStringify', () => {
  it('はキー順に依存しない安定文字列を返す（LOG-2 重複排除の前提）', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it('はネストしたオブジェクトのキーもソートする', () => {
    expect(stableStringify({ x: { c: 3, a: 1 } })).toBe('{"x":{"a":1,"c":3}}');
  });

  it('は配列の順序を保持する（順序は意味を持つ）', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });
});

describe('sha256Hex', () => {
  it('は既知の sha256 を返す（決定論）', () => {
    // "" の sha256
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('は同一入力に同一ハッシュを返す', () => {
    expect(sha256Hex('flowops')).toBe(sha256Hex('flowops'));
  });
});

describe('hashContent', () => {
  it('は payload 未指定で null を返す', () => {
    expect(hashContent(undefined)).toBeNull();
    expect(hashContent(null)).toBeNull();
  });

  it('はキー順が違っても同一内容なら同一ハッシュ（LOG-2 重複排除）', () => {
    expect(hashContent({ title: 't', body: 'b' })).toBe(hashContent({ body: 'b', title: 't' }));
  });

  it('は内容が違えば異なるハッシュ', () => {
    expect(hashContent({ v: 1 })).not.toBe(hashContent({ v: 2 }));
  });
});

describe('hashPolicy', () => {
  it('は version 表記が同じでも中身が変われば異なる指紋になる（POL-2 改変検知）', () => {
    const v1 = { id: 'g', version: '1.0.0', policy: { onCritical: 'stop' } };
    const tampered = { id: 'g', version: '1.0.0', policy: { onCritical: 'go' } };
    expect(hashPolicy(v1)).not.toBe(hashPolicy(tampered));
  });

  it('は null/undefined で null を返す', () => {
    expect(hashPolicy(null)).toBeNull();
    expect(hashPolicy(undefined)).toBeNull();
  });
});
