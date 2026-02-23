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
    default:
      return { open: '[', close: ']' };
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
    default:
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

  // ノード定義
  lines.push('  %% Nodes');
  for (const [nodeId, node] of Object.entries(flow.nodes)) {
    const shape = getNodeShape(node.type);
    const prefixedId = `${nodeIdPrefix}${nodeId}`;
    const label = escapeLabel(node.label);

    // ノード定義
    lines.push(`  ${prefixedId}${shape.open}"${label}"${shape.close}`);

    // クリックハンドラー（オプション）
    if (includeClickHandlers) {
      lines.push(`  click ${prefixedId} callback "${nodeId}"`);
    }
  }
  lines.push('');

  // エッジ定義
  lines.push('  %% Edges');
  for (const [edgeId, edge] of Object.entries(flow.edges)) {
    const fromId = `${nodeIdPrefix}${edge.from}`;
    const toId = `${nodeIdPrefix}${edge.to}`;

    if (edge.label) {
      // ラベル付きエッジ
      lines.push(`  ${fromId} -->|"${escapeLabel(edge.label)}"| ${toId}`);
    } else {
      // ラベルなしエッジ
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
    lines.push('');

    // クラス適用
    for (const [nodeId, node] of Object.entries(flow.nodes)) {
      const prefixedId = `${nodeIdPrefix}${nodeId}`;
      const nodeClass = getNodeClass(node.type);
      lines.push(`  class ${prefixedId} ${nodeClass}`);
    }
  }

  return lines.join('\n');
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
