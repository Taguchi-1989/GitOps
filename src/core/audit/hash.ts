/**
 * FlowOps - Audit Content Hashing
 *
 * ガバナンス・ハーネス LOG-1 / LOG-2 / POL-2 のコンテンツアドレス化。
 *
 * 監査ログには実体（payload）を直接ではなく、その sha256 ハッシュを刻む。
 * 同一内容は同一ハッシュになるため、重複排除（LOG-2）と
 * 「どのポリシー版で判定したか」の再現（POL-2）が決定論的に成立する。
 *
 * 決定論性の要: オブジェクトはキーを再帰的にソートしてから直列化する。
 * これにより `{a:1,b:2}` と `{b:2,a:1}` が同一ハッシュになる。
 */

import { createHash } from 'crypto';

/**
 * 任意の値を、キー順に依存しない安定した JSON 文字列へ直列化する。
 * 配列の順序は意味を持つため保持する。
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep(source[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * UTF-8 文字列の sha256 を 16 進で返す。
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * 監査 payload のコンテンツハッシュ（LOG-1）。
 * payload が未指定（null/undefined）なら null を返す。
 */
export function hashContent(payload: unknown): string | null {
  if (payload === undefined || payload === null) {
    return null;
  }
  return sha256Hex(stableStringify(payload));
}

/**
 * ポリシー（ゲート定義等）の内容ハッシュ（POL-2 / G3）。
 * バージョン文字列だけでなく内容自体を指紋化し、
 * 「同じ version 表記で中身が差し替わった」改変を検知可能にする。
 */
export function hashPolicy(policy: unknown): string | null {
  if (policy === undefined || policy === null) {
    return null;
  }
  return sha256Hex(stableStringify(policy));
}
