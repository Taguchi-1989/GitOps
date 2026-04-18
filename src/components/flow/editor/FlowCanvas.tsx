'use client';

import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { Flow } from '@/core/parser/schema';
import { flowToReactFlow } from './converters';
import { CustomNode } from './CustomNode';
import type { FlowNode, FlowNodeData } from './types';

// Cast required: @xyflow/react NodeTypes expects ComponentType<NodeProps<Node>>
// but CustomNode is typed as NodeProps<FlowNode> (a subtype). The cast is safe.
const nodeTypes: NodeTypes = {
  customNode: CustomNode as NodeTypes[string],
};

interface FlowCanvasProps {
  flow: Flow;
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
  className?: string;
}

export function FlowCanvas({ flow, onNodeClick, selectedNodeId, className }: FlowCanvasProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => flowToReactFlow(flow), [flow]);

  // Inject selected state into node data
  const nodesWithSelection = useMemo(
    () =>
      initialNodes.map(node => ({
        ...node,
        selected: node.id === selectedNodeId,
      })),
    [initialNodes, selectedNodeId]
  );

  const [nodes, , onNodesChange] = useNodesState<FlowNode>(nodesWithSelection);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  return (
    <div className={`w-full h-full min-h-[400px] ${className ?? ''}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        attributionPosition="bottom-right"
      >
        <MiniMap
          nodeColor={node => {
            const data = node.data as FlowNodeData;
            const colorMap: Record<string, string> = {
              start: '#10b981',
              end: '#ef4444',
              process: '#3b82f6',
              decision: '#f59e0b',
              database: '#8b5cf6',
              'llm-task': '#ec4899',
              'human-review': '#14b8a6',
            };
            return colorMap[data?.nodeType ?? ''] ?? '#6b7280';
          }}
          zoomable
          pannable
        />
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
      </ReactFlow>
    </div>
  );
}

export default FlowCanvas;
