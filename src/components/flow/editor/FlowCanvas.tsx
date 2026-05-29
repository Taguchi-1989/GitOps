'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  type EdgeMouseHandler,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { Flow } from '@/core/parser/schema';
import { flowToReactFlow } from './converters';
import { CustomNode } from './CustomNode';
import { NODE_STYLE_MAP } from './node-styles';
import type { FlowNode, FlowEdge, FlowNodeData } from './types';

// Cast required: @xyflow/react NodeTypes expects ComponentType<NodeProps<Node>>
// but CustomNode is typed as NodeProps<FlowNode> (a subtype). The cast is safe.
const nodeTypes: NodeTypes = {
  customNode: CustomNode as NodeTypes[string],
};

interface FlowCanvasProps {
  flow: Flow;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  selectedNodeId?: string | null;
  className?: string;
  // Editable mode props
  editable?: boolean;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  onNodesChange?: OnNodesChange<FlowNode>;
  onEdgesChange?: OnEdgesChange<FlowEdge>;
  onConnect?: OnConnect;
  onDeleteSelected?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function FlowCanvas({
  flow,
  onNodeClick,
  onEdgeClick,
  selectedNodeId,
  className,
  editable = false,
  nodes: externalNodes,
  edges: externalEdges,
  onNodesChange: externalOnNodesChange,
  onEdgesChange: externalOnEdgesChange,
  onConnect,
  onDeleteSelected,
  onUndo,
  onRedo,
}: FlowCanvasProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => flowToReactFlow(flow), [flow]);

  // Inject selected state into node data (view-only mode)
  const nodesWithSelection = useMemo(
    () =>
      initialNodes.map(node => ({
        ...node,
        selected: node.id === selectedNodeId,
      })),
    [initialNodes, selectedNodeId]
  );

  // In editable mode, use external controlled state from useFlowEditor.
  // In view mode, drive ReactFlow directly with the converted nodes (controlled, no-op handler)
  // to avoid the controlled/uncontrolled conflict that causes the StoreUpdater infinite loop.
  const [internalNodes, , internalOnNodesChange] = useNodesState<FlowNode>(nodesWithSelection);
  const [internalEdges, , internalOnEdgesChange] = useEdgesState(initialEdges);

  const nodes = editable ? (externalNodes ?? internalNodes) : nodesWithSelection;
  const edges = editable ? (externalEdges ?? internalEdges) : initialEdges;
  const onNodesChange = editable
    ? (externalOnNodesChange ?? internalOnNodesChange)
    : internalOnNodesChange;
  const onEdgesChange = editable
    ? (externalOnEdgesChange ?? internalOnEdgesChange)
    : internalOnEdgesChange;

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      onEdgeClick?.(edge.id);
    },
    [onEdgeClick]
  );

  // Dark モード検出: Background ドットや MiniMap のマスク色を背景に合わせて切替える
  const [isDark, setIsDark] = useState<boolean>(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcuts for editable mode (Delete, Ctrl+Z, Ctrl+Shift+Z)
  useEffect(() => {
    if (!editable) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only fire if not focused on an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        onDeleteSelected?.();
      } else if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        onRedo?.();
      } else if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        onUndo?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editable, onDeleteSelected, onUndo, onRedo]);

  return (
    <div className={`w-full h-full min-h-[400px] ${className ?? ''}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={editable ? onConnect : undefined}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        nodeTypes={nodeTypes}
        nodesDraggable={editable}
        nodesConnectable={editable}
        elementsSelectable={editable}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        attributionPosition="bottom-right"
        deleteKeyCode={null}
      >
        <MiniMap
          nodeColor={node => {
            const data = node.data as FlowNodeData;
            return NODE_STYLE_MAP[data?.nodeType]?.hexColor ?? '#6b7280';
          }}
          maskColor={isDark ? 'rgba(17, 24, 39, 0.7)' : 'rgba(240, 240, 240, 0.7)'}
          style={{
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
          }}
          zoomable
          pannable
        />
        <Controls />
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color={isDark ? '#4b5563' : '#d1d5db'}
        />
      </ReactFlow>
    </div>
  );
}

export default FlowCanvas;
