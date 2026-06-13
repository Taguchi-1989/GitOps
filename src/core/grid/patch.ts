/**
 * FlowOps - Grid JSON Patch Builder
 *
 * 編集前後の Flow から RFC 6902 JSON Patch を生成する。
 *
 * 粒度はノード/エッジ単位(フィールド単位ではなく `/nodes/{id}` 全体を
 * replace)。これにより:
 *  - JSON Pointer のエスケープ対象が id 1階層に限定され安全。
 *  - 既存 applyPatches(`replace` は path 存在を要求) と整合する。
 *
 * グリッドはフローメタデータ(title/layer等)を編集しないため nodes/edges のみ比較する。
 */

import type { Flow } from '@/core/parser/schema';
import type { JsonPatch } from '@/core/patch/types';

/** JSON Pointer セグメントのエスケープ(`~`→`~0`, `/`→`~1`)。 */
function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * キー順序に依存しない安定 stringify（差分比較用）。
 * グリッド再構築でプロパティ順が変わっても誤検出しないようにする。
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** Record の add/remove/replace 差分を JSON Patch に変換する。 */
function diffRecord(
  base: string,
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>
): JsonPatch[] {
  const patches: JsonPatch[] = [];
  const oldKeys = Object.keys(oldRecord);
  const newKeys = Object.keys(newRecord);
  const oldSet = new Set(oldKeys);
  const newSet = new Set(newKeys);

  // 追加
  for (const key of newKeys) {
    if (!oldSet.has(key)) {
      patches.push({
        op: 'add',
        path: `${base}/${escapePointerSegment(key)}`,
        value: newRecord[key],
      });
    }
  }

  // 変更(両方に存在し内容が異なる)
  for (const key of newKeys) {
    if (oldSet.has(key)) {
      if (stableStringify(oldRecord[key]) !== stableStringify(newRecord[key])) {
        patches.push({
          op: 'replace',
          path: `${base}/${escapePointerSegment(key)}`,
          value: newRecord[key],
        });
      }
    }
  }

  // 削除
  for (const key of oldKeys) {
    if (!newSet.has(key)) {
      patches.push({ op: 'remove', path: `${base}/${escapePointerSegment(key)}` });
    }
  }

  return patches;
}

/**
 * 編集前後の Flow から nodes/edges の JSON Patch を生成する。
 * 変更がなければ空配列を返す。
 */
export function buildJsonPatch(oldFlow: Flow, newFlow: Flow): JsonPatch[] {
  return [
    ...diffRecord(
      '/nodes',
      oldFlow.nodes as Record<string, unknown>,
      newFlow.nodes as Record<string, unknown>
    ),
    ...diffRecord(
      '/edges',
      oldFlow.edges as Record<string, unknown>,
      newFlow.edges as Record<string, unknown>
    ),
  ];
}
