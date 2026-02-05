/**
 * FlowOps - Hash Utilities
 * 
 * baseHash計算用のユーティリティ
 */

import { createHash } from 'crypto';

/**
 * 文字列のSHA256ハッシュを計算
 * @param content ハッシュ対象の文字列
 */
export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * オブジェクトのハッシュを計算（JSON.stringify経由）
 * @param obj ハッシュ対象のオブジェクト
 */
export function hashObject(obj: unknown): string {
  const json = JSON.stringify(obj, null, 0);
  return sha256(json);
}

/**
 * 短縮ハッシュを取得（表示用）
 * @param hash フルハッシュ
 * @param length 長さ（デフォルト: 8）
 */
export function shortHash(hash: string, length = 8): string {
  return hash.substring(0, length);
}

/**
 * 2つのハッシュが一致するか確認
 */
export function hashMatch(hash1: string, hash2: string): boolean {
  // タイミング攻撃対策として一定時間で比較
  if (hash1.length !== hash2.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < hash1.length; i++) {
    result |= hash1.charCodeAt(i) ^ hash2.charCodeAt(i);
  }
  
  return result === 0;
}
