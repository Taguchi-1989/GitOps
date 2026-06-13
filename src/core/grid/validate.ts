/**
 * FlowOps - Grid Row Validation
 *
 * グリッド行をセル単位で検証する。サーバ/クライアント両方で同じ関数を使う
 * (isomorphic)。Zod スキーマを単一フィールド検証に流用し、enum 違反は
 * 日本語メッセージにする。
 */

import { NodeTypeSchema, DataLayerSchema } from '@/core/parser/schema';
import type { NodeRow, EdgeRow, CellError } from './types';

const NODE_TYPE_LABEL = NodeTypeSchema.options.join(' / ');
const DATA_LAYER_LABEL = DataLayerSchema.options.join(' / ');

/**
 * ノード行・エッジ行を検証して CellError の配列を返す。
 * - error: 保存をブロックする
 * - warning: 保存は許可するが注意喚起する
 */
export function validateRows(nodeRows: NodeRow[], edgeRows: EdgeRow[]): CellError[] {
  const errors: CellError[] = [];

  // --- ノード ---
  const nodeIds = new Set<string>();
  const seenNodeIds = new Set<string>();
  nodeRows.forEach((row, rowIndex) => {
    const id = row.id.trim();
    if (!id) {
      errors.push({
        scope: 'node',
        rowIndex,
        field: 'id',
        message: 'IDは必須です',
        severity: 'error',
      });
    } else {
      if (seenNodeIds.has(id)) {
        errors.push({
          scope: 'node',
          rowIndex,
          field: 'id',
          message: `ノードIDが重複しています: ${id}`,
          severity: 'error',
        });
      }
      seenNodeIds.add(id);
      nodeIds.add(id);
    }

    if (!NodeTypeSchema.safeParse(row.type.trim()).success) {
      errors.push({
        scope: 'node',
        rowIndex,
        field: 'type',
        message: `typeは ${NODE_TYPE_LABEL} のいずれかを指定してください`,
        severity: 'error',
      });
    }

    if (!row.label.trim()) {
      errors.push({
        scope: 'node',
        rowIndex,
        field: 'label',
        message: 'ラベルは必須です',
        severity: 'error',
      });
    }
  });

  // --- エッジ ---
  const seenEdgeIds = new Set<string>();
  edgeRows.forEach((row, rowIndex) => {
    const id = row.id.trim();
    if (!id) {
      errors.push({
        scope: 'edge',
        rowIndex,
        field: 'id',
        message: 'IDは必須です',
        severity: 'error',
      });
    } else {
      if (seenEdgeIds.has(id)) {
        errors.push({
          scope: 'edge',
          rowIndex,
          field: 'id',
          message: `エッジIDが重複しています: ${id}`,
          severity: 'error',
        });
      }
      seenEdgeIds.add(id);
    }

    // 参照整合性: from/to は存在するノードを指すこと
    const from = row.from.trim();
    if (!from) {
      errors.push({
        scope: 'edge',
        rowIndex,
        field: 'from',
        message: 'fromは必須です',
        severity: 'error',
      });
    } else if (!nodeIds.has(from)) {
      errors.push({
        scope: 'edge',
        rowIndex,
        field: 'from',
        message: `存在しないノードを参照しています: ${from}`,
        severity: 'error',
      });
    }

    const to = row.to.trim();
    if (!to) {
      errors.push({
        scope: 'edge',
        rowIndex,
        field: 'to',
        message: 'toは必須です',
        severity: 'error',
      });
    } else if (!nodeIds.has(to)) {
      errors.push({
        scope: 'edge',
        rowIndex,
        field: 'to',
        message: `存在しないノードを参照しています: ${to}`,
        severity: 'error',
      });
    }

    if (row.dataLayer.trim() && !DataLayerSchema.safeParse(row.dataLayer.trim()).success) {
      errors.push({
        scope: 'edge',
        rowIndex,
        field: 'dataLayer',
        message: `dataLayerは ${DATA_LAYER_LABEL} のいずれかを指定してください`,
        severity: 'error',
      });
    }
  });

  // --- フロー全体(警告) ---
  const hasStart = nodeRows.some(r => r.type.trim() === 'start');
  const hasEnd = nodeRows.some(r => r.type.trim() === 'end');
  if (!hasStart || !hasEnd) {
    errors.push({
      scope: 'flow',
      rowIndex: -1,
      field: 'type',
      message: 'start ノードと end ノードが各1つ以上あることを推奨します',
      severity: 'warning',
    });
  }

  return errors;
}
