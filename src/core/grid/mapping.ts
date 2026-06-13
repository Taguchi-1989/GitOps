/**
 * FlowOps - Grid <-> Flow Mapping
 *
 * Flow の nodes/edges とグリッド行の相互変換。
 *
 * ラウンドトリップ規則:
 *   グリッドに現れないフィールド(dataClassification, description 以外の meta キー)は
 *   baseFlow から id でマージバックする。グリッド編集でガバナンスメタデータを
 *   絶対に欠落させない。
 */

import type { Flow, Node, Edge, NodeType, DataLayer } from '@/core/parser/schema';
import type { NodeRow, EdgeRow } from './types';

/** 空白除去し、空なら undefined を返す(optional プロパティ省略用)。 */
function opt(value: string): string | undefined {
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

export function flowToNodeRows(flow: Flow): NodeRow[] {
  return Object.entries(flow.nodes).map(([id, node]) => ({
    id,
    type: node.type,
    label: node.label,
    role: node.role ?? '',
    system: node.system ?? '',
    taskId: node.taskId ?? '',
    description: typeof node.meta?.description === 'string' ? node.meta.description : '',
  }));
}

export function flowToEdgeRows(flow: Flow): EdgeRow[] {
  return Object.entries(flow.edges).map(([id, edge]) => ({
    id,
    from: edge.from,
    to: edge.to,
    label: edge.label ?? '',
    condition: edge.condition ?? '',
    dataLayer: edge.dataLayer ?? '',
  }));
}

/**
 * グリッド行から Flow を再構築する。baseFlow は未表現フィールドの保全に使う。
 * 注意: バリデーションは行わない(呼び出し前に validateRows で検証すること)。
 */
export function rowsToFlow(baseFlow: Flow, nodeRows: NodeRow[], edgeRows: EdgeRow[]): Flow {
  const nodes: Record<string, Node> = {};
  for (const row of nodeRows) {
    const id = row.id.trim();
    if (!id) continue;
    const baseNode = baseFlow.nodes[id];

    // meta: ベースの meta を引き継ぎつつ description だけグリッド値で上書き
    const meta: Record<string, unknown> = { ...(baseNode?.meta ?? {}) };
    const description = opt(row.description);
    if (description) {
      meta.description = description;
    } else {
      delete meta.description;
    }

    const node: Node = {
      id,
      type: row.type.trim() as NodeType,
      label: row.label.trim(),
      ...(opt(row.role) ? { role: opt(row.role) } : {}),
      ...(opt(row.system) ? { system: opt(row.system) } : {}),
      ...(opt(row.taskId) ? { taskId: opt(row.taskId) } : {}),
      // グリッド非表現フィールドを保全
      ...(baseNode?.dataClassification ? { dataClassification: baseNode.dataClassification } : {}),
      ...(Object.keys(meta).length > 0 ? { meta } : {}),
    };
    nodes[id] = node;
  }

  const edges: Record<string, Edge> = {};
  for (const row of edgeRows) {
    const id = row.id.trim();
    if (!id) continue;
    const edge: Edge = {
      id,
      from: row.from.trim(),
      to: row.to.trim(),
      ...(opt(row.label) ? { label: opt(row.label) } : {}),
      ...(opt(row.condition) ? { condition: opt(row.condition) } : {}),
      ...(opt(row.dataLayer) ? { dataLayer: row.dataLayer.trim() as DataLayer } : {}),
    };
    edges[id] = edge;
  }

  return { ...baseFlow, nodes, edges };
}
