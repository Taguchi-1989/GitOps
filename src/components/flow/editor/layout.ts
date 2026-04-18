import dagre from 'dagre';
import type { FlowNode, FlowEdge } from './types';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

/**
 * Apply dagre automatic layout to React Flow nodes and edges.
 * Nodes that already have a non-zero position stored in data.meta.position
 * retain their existing position; only nodes without a persisted position are
 * placed by dagre.
 *
 * Note: this function is only called when at least one node lacks a position.
 * When all nodes have persisted positions, converters.ts skips this function
 * entirely and uses the persisted positions directly.
 */
export function applyDagreLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  direction: 'TB' | 'LR' = 'TB'
): FlowNode[] {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 80,
  });

  for (const node of nodes) {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  dagre.layout(dagreGraph);

  return nodes.map(node => {
    // If this node already has a persisted position in meta, preserve it.
    const metaPos = node.data.meta?.position as Record<string, unknown> | undefined;
    if (metaPos && typeof metaPos.x === 'number' && typeof metaPos.y === 'number') {
      return {
        ...node,
        position: { x: metaPos.x, y: metaPos.y },
      };
    }

    // Otherwise use the dagre-computed position.
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });
}
