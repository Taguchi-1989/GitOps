/**
 * FlowOps - Flow to Mermaid Converter
 *
 * FlowオブジェクトをMermaid記法に変換
 */

import { Flow, Node, NodeType } from './schema';

/**
 * ノードタイプをMermaidのシェイプに変換
 */
function getNodeShape(type: NodeType): { open: string; close: string } {
  switch (type) {
    case 'start':
      return { open: '([', close: '])' }; // Stadium shape (rounded)
    case 'end':
      return { open: '([', close: '])' }; // Stadium shape (rounded)
    case 'process':
      return { open: '[', close: ']' }; // Rectangle
    case 'decision':
      return { open: '{', close: '}' }; // Diamond
    case 'database':
      return { open: '[(', close: ')]' }; // Cylinder
    case 'llm-task':
      return { open: '{{', close: '}}' }; // Hexagon
    case 'human-review':
      return { open: '[[', close: ']]' }; // Subroutine
  }
}

/**
 * ノードのスタイルクラスを取得
 */
function getNodeClass(type: NodeType): string {
  switch (type) {
    case 'start':
      return 'startNode';
    case 'end':
      return 'endNode';
    case 'decision':
      return 'decisionNode';
    case 'database':
      return 'databaseNode';
    case 'llm-task':
      return 'llmTaskNode';
    case 'human-review':
      return 'humanReviewNode';
    case 'process':
      return 'processNode';
  }
}

/**
 * ラベルをエスケープ（Mermaid用）
 */
function escapeLabel(label: string): string {
  return label.replace(/"/g, '#quot;').replace(/\n/g, '<br/>');
}

export interface MermaidOptions {
  direction?: 'TD' | 'TB' | 'LR' | 'RL' | 'BT';
  includeStyles?: boolean;
  includeClickHandlers?: boolean;
  nodeIdPrefix?: string;
}

/**
 * FlowをMermaid記法に変換
 * @param flow Flowオブジェクト
 * @param options オプション設定
 */
export function flowToMermaid(flow: Flow, options: MermaidOptions = {}): string {
  const {
    direction = 'TD',
    includeStyles = true,
    includeClickHandlers = false,
    nodeIdPrefix = '',
  } = options;

  const lines: string[] = [];

  // グラフ開始
  lines.push(`graph ${direction}`);
  lines.push('');

  // meta.group でグループ情報を収集
  const groupedNodeIds = new Map<string, string>();
  for (const [nodeId, node] of Object.entries(flow.nodes)) {
    const meta = node.meta as Record<string, unknown> | undefined;
    const groupId = meta?.group as string | undefined;
    if (groupId) {
      groupedNodeIds.set(nodeId, groupId);
    }
  }

  // ノード定義
  lines.push('  %% Nodes');
  for (const [nodeId, node] of Object.entries(flow.nodes)) {
    const isGrouped = groupedNodeIds.has(nodeId);
    lines.push(renderNodeLine(node, nodeId, nodeIdPrefix, includeClickHandlers, isGrouped));
  }
  lines.push('');

  // エッジ定義
  lines.push('  %% Edges');
  for (const edge of Object.values(flow.edges)) {
    const fromId = `${nodeIdPrefix}${edge.from}`;
    const toId = `${nodeIdPrefix}${edge.to}`;

    if (edge.label) {
      lines.push(`  ${fromId} -->|"${escapeLabel(edge.label)}"| ${toId}`);
    } else {
      lines.push(`  ${fromId} --> ${toId}`);
    }
  }

  // スタイル定義（オプション）
  if (includeStyles) {
    lines.push('');
    lines.push('  %% Styles');
    lines.push('  classDef startNode fill:#10b981,stroke:#059669,color:#fff');
    lines.push('  classDef endNode fill:#ef4444,stroke:#dc2626,color:#fff');
    lines.push('  classDef processNode fill:#3b82f6,stroke:#2563eb,color:#fff');
    lines.push('  classDef decisionNode fill:#f59e0b,stroke:#d97706,color:#fff');
    lines.push('  classDef databaseNode fill:#8b5cf6,stroke:#7c3aed,color:#fff');
    lines.push('  classDef llmTaskNode fill:#ec4899,stroke:#db2777,color:#fff');
    lines.push('  classDef humanReviewNode fill:#14b8a6,stroke:#0d9488,color:#fff');
    lines.push('');

    // グループノード用のハイライトスタイル
    if (groupedNodeIds.size > 0) {
      lines.push(
        '  classDef groupHighlight fill:#d97706,stroke:#f59e0b,stroke-width:4px,color:#fff,stroke-dasharray:0'
      );
    }
    lines.push('');

    // クラス適用（グループノードはハイライトクラスを使用）
    for (const [nodeId, node] of Object.entries(flow.nodes)) {
      const prefixedId = `${nodeIdPrefix}${nodeId}`;
      if (groupedNodeIds.has(nodeId)) {
        lines.push(`  class ${prefixedId} groupHighlight`);
      } else {
        const nodeClass = getNodeClass(node.type);
        lines.push(`  class ${prefixedId} ${nodeClass}`);
      }
    }
  }

  return lines.join('\n');
}

function renderNodeLine(
  node: Node,
  nodeId: string,
  nodeIdPrefix: string,
  includeClickHandlers: boolean,
  isGrouped: boolean = false
): string {
  const shape = getNodeShape(node.type);
  const prefixedId = `${nodeIdPrefix}${nodeId}`;
  const label = escapeLabel(node.label);
  const classSuffix = isGrouped ? ':::groupHighlight' : '';
  let line = `  ${prefixedId}${shape.open}"${label}"${shape.close}${classSuffix}`;
  if (includeClickHandlers) {
    line += `\n  click ${prefixedId} callback "${nodeId}"`;
  }
  return line;
}

/**
 * フローのサマリー情報を生成
 */
export function getFlowSummary(flow: Flow): {
  nodeCount: number;
  edgeCount: number;
  nodeTypes: Record<NodeType, number>;
  roles: string[];
  systems: string[];
} {
  const nodeTypes: Record<string, number> = {};
  const roles = new Set<string>();
  const systems = new Set<string>();

  for (const node of Object.values(flow.nodes)) {
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    if (node.role) roles.add(node.role);
    if (node.system) systems.add(node.system);
  }

  return {
    nodeCount: Object.keys(flow.nodes).length,
    edgeCount: Object.keys(flow.edges).length,
    nodeTypes: nodeTypes as Record<NodeType, number>,
    roles: Array.from(roles),
    systems: Array.from(systems),
  };
}
