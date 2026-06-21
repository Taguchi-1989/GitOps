/**
 * FlowOps - Sample Audit (ガバナンス・ハーネス §5.2 ゴム印化の防止)
 *
 * 自動承認された判断を「全件は見ないが抜き取って人が振り返る」ための
 * 決定論的サンプリング。検査機構自身を PDCA の A（改善）に乗せる仕掛け。
 *
 * 決定論性: Math.random を使わず、キーのハッシュから [0,1) を導く。
 * 同じキーは常に同じ判定（再現可能・テスト可能）。
 */

import { sha256Hex } from '../audit';

/**
 * キーから [0,1) の一様な値を導く（sha256 の先頭32bitを正規化）。
 */
export function sampleHash(key: string): number {
  const hex = sha256Hex(key).slice(0, 8);
  const int = parseInt(hex, 16);
  return int / 0x100000000; // 2^32
}

/**
 * このキーをサンプル監査対象に選ぶか。
 * @param key  イベント単位の安定キー（例: approvalRequestId / proposalId）
 * @param rate 0..1。0 なら常に false、1 なら常に true。
 */
export function shouldSampleAudit(key: string, rate: number): boolean {
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  return sampleHash(key) < rate;
}
