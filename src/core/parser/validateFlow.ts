/**
 * FlowOps - Flow Integrity Validator
 * 
 * Zodスキーマでは検証できない参照整合性をチェック
 */

import { Flow, Node, Edge, ValidationError, ValidationResult, Dictionary } from './schema';

/**
 * フローの参照整合性をチェック
 * @param flow Flowオブジェクト
 * @param dictionary オプション：role/system辞書
 */
export function validateFlowIntegrity(
  flow: Flow,
  dictionary?: Dictionary
): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. ノードIDの存在確認（Recordなので基本的にOK）
  const nodeIds = new Set(Object.keys(flow.nodes));

  // 2. Edgeの参照チェック
  for (const [edgeId, edge] of Object.entries(flow.edges)) {
    if (!nodeIds.has(edge.from)) {
      errors.push({
        code: 'MISSING_NODE_REF',
        message: `Edge "${edgeId}" references non-existent node: from="${edge.from}"`,
        path: `edges.${edgeId}.from`,
      });
    }
    if (!nodeIds.has(edge.to)) {
      errors.push({
        code: 'MISSING_NODE_REF',
        message: `Edge "${edgeId}" references non-existent node: to="${edge.to}"`,
        path: `edges.${edgeId}.to`,
      });
    }
  }

  // 3. Start/Endノードの存在確認
  const nodeTypes = Object.values(flow.nodes).map(n => n.type);
  const hasStart = nodeTypes.includes('start');
  const hasEnd = nodeTypes.includes('end');

  if (!hasStart) {
    errors.push({
      code: 'MISSING_START_END',
      message: 'Flow must have at least one "start" node',
      path: 'nodes',
    });
  }

  if (!hasEnd) {
    errors.push({
      code: 'MISSING_START_END',
      message: 'Flow must have at least one "end" node',
      path: 'nodes',
    });
  }

  // 4. 辞書参照チェック（辞書が提供された場合）
  if (dictionary) {
    for (const [nodeId, node] of Object.entries(flow.nodes)) {
      // Role チェック
      if (node.role && !dictionary.roles[node.role]) {
        errors.push({
          code: 'UNKNOWN_ROLE',
          message: `Node "${nodeId}" references unknown role: "${node.role}"`,
          path: `nodes.${nodeId}.role`,
        });
      }

      // System チェック
      if (node.system && !dictionary.systems[node.system]) {
        errors.push({
          code: 'UNKNOWN_SYSTEM',
          message: `Node "${nodeId}" references unknown system: "${node.system}"`,
          path: `nodes.${nodeId}.system`,
        });
      }
    }
  }

  // 5. 孤立ノードチェック（警告レベル、エラーにはしない）
  const connectedNodes = new Set<string>();
  for (const edge of Object.values(flow.edges)) {
    connectedNodes.add(edge.from);
    connectedNodes.add(edge.to);
  }

  for (const nodeId of nodeIds) {
    const node = flow.nodes[nodeId];
    // start/endノード以外で接続がないものは警告
    if (!connectedNodes.has(nodeId) && node.type !== 'start' && node.type !== 'end') {
      // 警告としてログ出力（エラーにはしない）
      console.warn(`[Validator] Isolated node detected: ${nodeId}`);
    }
  }

  // 6. 到達可能性チェック（startから全ノードに到達できるか）
  const startNodes = Object.entries(flow.nodes)
    .filter(([, node]) => node.type === 'start')
    .map(([id]) => id);

  if (startNodes.length > 0) {
    const reachable = new Set<string>();
    const queue = [...startNodes];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);

      // このノードから出ているエッジを探す
      for (const edge of Object.values(flow.edges)) {
        if (edge.from === current && !reachable.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }

    // 到達不可能なノードをチェック
    for (const nodeId of nodeIds) {
      if (!reachable.has(nodeId)) {
        // 警告としてログ出力（エラーにはしない）
        console.warn(`[Validator] Unreachable node from start: ${nodeId}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 2つのフローの差分を検出（簡易版）
 */
export function detectFlowChanges(
  oldFlow: Flow,
  newFlow: Flow
): { added: string[]; removed: string[]; modified: string[] } {
  const oldNodeIds = new Set(Object.keys(oldFlow.nodes));
  const newNodeIds = new Set(Object.keys(newFlow.nodes));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  // 追加されたノード
  for (const id of newNodeIds) {
    if (!oldNodeIds.has(id)) {
      added.push(id);
    }
  }

  // 削除されたノード
  for (const id of oldNodeIds) {
    if (!newNodeIds.has(id)) {
      removed.push(id);
    }
  }

  // 変更されたノード
  for (const id of newNodeIds) {
    if (oldNodeIds.has(id)) {
      const oldNode = JSON.stringify(oldFlow.nodes[id]);
      const newNode = JSON.stringify(newFlow.nodes[id]);
      if (oldNode !== newNode) {
        modified.push(id);
      }
    }
  }

  return { added, removed, modified };
}
