import type { Flow, Node as FlowSchemaNode, Edge as FlowSchemaEdge } from '@/core/parser/schema';
import type { FlowNode, FlowEdge } from './types';
import { applyDagreLayout } from './layout';

/**
 * Convert a Flow (YAML schema) to React Flow nodes and edges.
 * Positions are taken from node.meta.position if available; otherwise dagre layout is applied.
 */
export function flowToReactFlow(flow: Flow): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = Object.values(flow.nodes).map((node: FlowSchemaNode) => {
    const hasPosition =
      node.meta?.position &&
      typeof (node.meta.position as Record<string, unknown>).x === 'number' &&
      typeof (node.meta.position as Record<string, unknown>).y === 'number';

    const position = hasPosition
      ? {
          x: (node.meta!.position as { x: number; y: number }).x,
          y: (node.meta!.position as { x: number; y: number }).y,
        }
      : { x: 0, y: 0 };

    return {
      id: node.id,
      type: 'customNode',
      position,
      data: {
        label: node.label,
        nodeType: node.type,
        role: node.role,
        system: node.system,
        taskId: node.taskId,
        meta: node.meta,
      },
    };
  });

  const edges: FlowEdge[] = Object.values(flow.edges).map((edge: FlowSchemaEdge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.label,
    data: {
      condition: edge.condition,
    },
  }));

  // If any node lacks a persisted position, apply dagre layout to all nodes
  const needsLayout = Object.values(flow.nodes).some(
    node =>
      !node.meta?.position || typeof (node.meta.position as Record<string, unknown>).x !== 'number'
  );

  const finalNodes = needsLayout ? applyDagreLayout(nodes, edges) : nodes;

  return { nodes: finalNodes, edges };
}

/**
 * Convert React Flow nodes and edges back to a Flow (YAML schema).
 * Node positions are stored in meta.position.
 */
export function reactFlowToFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  metadata: Pick<Flow, 'id' | 'title' | 'layer' | 'updatedAt'> &
    Partial<Omit<Flow, 'id' | 'title' | 'layer' | 'updatedAt' | 'nodes' | 'edges'>>
): Flow {
  const flowNodes: Record<string, FlowSchemaNode> = {};
  for (const node of nodes) {
    const { label, nodeType, role, system, taskId, meta, ...rest } = node.data;
    void rest;
    flowNodes[node.id] = {
      id: node.id,
      type: nodeType,
      label,
      ...(role !== undefined && { role }),
      ...(system !== undefined && { system }),
      ...(taskId !== undefined && { taskId }),
      meta: {
        ...(meta ?? {}),
        position: { x: node.position.x, y: node.position.y },
      },
    };
  }

  const flowEdges: Record<string, FlowSchemaEdge> = {};
  for (const edge of edges) {
    flowEdges[edge.id] = {
      id: edge.id,
      from: edge.source,
      to: edge.target,
      ...(edge.label !== undefined && { label: String(edge.label) }),
      ...(edge.data?.condition !== undefined && { condition: edge.data.condition }),
    };
  }

  return {
    ...metadata,
    nodes: flowNodes,
    edges: flowEdges,
  };
}
