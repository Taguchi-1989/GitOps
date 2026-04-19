'use client';

import { useCallback, useRef, useState } from 'react';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react';
import type { Flow } from '@/core/parser/schema';
import type { NodeType } from '@/core/parser/schema';
import { flowToReactFlow, reactFlowToFlow } from './converters';
import { applyDagreLayout } from './layout';
import type { FlowNode, FlowEdge, FlowNodeData } from './types';

const MAX_UNDO = 20;

interface Snapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export function useFlowEditor(initialFlow: Flow) {
  const { nodes: initNodes, edges: initEdges } = flowToReactFlow(initialFlow);

  const [nodes, setNodes] = useState<FlowNode[]>(initNodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initEdges);
  const [isDirty, setIsDirty] = useState(false);
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);

  // Refs to always access current values inside callbacks (avoids stale closures)
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const pushUndo = useCallback((snap: Snapshot) => {
    setUndoStack(prev => {
      const next = [...prev, snap];
      return next.length > MAX_UNDO ? next.slice(next.length - MAX_UNDO) : next;
    });
    setRedoStack([]);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes(prev => {
      const updated = applyNodeChanges(changes, prev);
      // Position changes are frequent (drag); only mark dirty on non-position changes
      // or on position commit (not while dragging)
      const hasSignificantChange = changes.some(
        c => c.type !== 'select' && c.type !== 'dimensions'
      );
      if (hasSignificantChange) {
        setIsDirty(true);
      }
      return updated;
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<FlowEdge>[]) => {
    setEdges(prev => {
      const updated = applyEdgeChanges(changes, prev);
      const hasSignificantChange = changes.some(c => c.type !== 'select');
      if (hasSignificantChange) {
        setIsDirty(true);
      }
      return updated;
    });
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      setNodes(prevNodes => {
        setEdges(prevEdges => {
          pushUndo({ nodes: prevNodes, edges: prevEdges });
          const newEdge: FlowEdge = {
            id: `edge_${crypto.randomUUID()}`,
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle ?? undefined,
            targetHandle: connection.targetHandle ?? undefined,
            data: {},
          };
          const updated = addEdge(newEdge, prevEdges) as FlowEdge[];
          setIsDirty(true);
          return updated;
        });
        return prevNodes;
      });
    },
    [pushUndo]
  );

  const addNode = useCallback(
    (type: NodeType) => {
      setNodes(prevNodes => {
        setEdges(prevEdges => {
          pushUndo({ nodes: prevNodes, edges: prevEdges });
          return prevEdges;
        });
        const newNode: FlowNode = {
          id: `node_${crypto.randomUUID()}`,
          type: 'customNode',
          position: { x: 200, y: 200 },
          data: {
            label: type,
            nodeType: type,
          } satisfies FlowNodeData,
        };
        setIsDirty(true);
        return [...prevNodes, newNode];
      });
    },
    [pushUndo]
  );

  const deleteSelected = useCallback(() => {
    setNodes(prevNodes => {
      setEdges(prevEdges => {
        pushUndo({ nodes: prevNodes, edges: prevEdges });
        const selectedNodeIds = new Set(prevNodes.filter(n => n.selected).map(n => n.id));
        const newEdges = prevEdges.filter(
          e => !e.selected && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)
        );
        setIsDirty(true);
        return newEdges;
      });
      const newNodes = prevNodes.filter(n => !n.selected);
      return newNodes;
    });
  }, [pushUndo]);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const snap = prev[prev.length - 1];
      const rest = prev.slice(0, prev.length - 1);
      setNodes(cur => {
        setRedoStack(r => [...r, { nodes: cur, edges: edgesRef.current }]);
        return snap.nodes;
      });
      setEdges(snap.edges);
      setIsDirty(true);
      return rest;
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const snap = prev[prev.length - 1];
      const rest = prev.slice(0, prev.length - 1);
      setNodes(cur => {
        setUndoStack(u => [...u, { nodes: cur, edges: edgesRef.current }]);
        return snap.nodes;
      });
      setEdges(snap.edges);
      setIsDirty(true);
      return rest;
    });
  }, []);

  const autoLayout = useCallback(() => {
    pushUndo({ nodes: nodesRef.current, edges: edgesRef.current });
    const laid = applyDagreLayout(nodesRef.current, edgesRef.current);
    setNodes(laid);
    setIsDirty(true);
  }, [pushUndo]);

  const updateNode = useCallback(
    (nodeId: string, data: Partial<FlowNodeData>) => {
      setNodes(prev => {
        setEdges(prevEdges => {
          pushUndo({ nodes: prev, edges: prevEdges });
          return prevEdges;
        });
        const updated = prev.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        );
        setIsDirty(true);
        return updated;
      });
    },
    [pushUndo]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes(prev => {
        setEdges(prevEdges => {
          pushUndo({ nodes: prev, edges: prevEdges });
          const newEdges = prevEdges.filter(e => e.source !== nodeId && e.target !== nodeId);
          setIsDirty(true);
          return newEdges;
        });
        return prev.filter(n => n.id !== nodeId);
      });
    },
    [pushUndo]
  );

  const updateEdge = useCallback(
    (edgeId: string, data: { label?: string; condition?: string }) => {
      setEdges(prev => {
        setNodes(prevNodes => {
          pushUndo({ nodes: prevNodes, edges: prev });
          return prevNodes;
        });
        const updated = prev.map(e =>
          e.id === edgeId
            ? {
                ...e,
                ...(data.label !== undefined && { label: data.label }),
                data: {
                  ...e.data,
                  ...(data.condition !== undefined && { condition: data.condition }),
                },
              }
            : e
        );
        setIsDirty(true);
        return updated;
      });
    },
    [pushUndo]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      setEdges(prev => {
        setNodes(prevNodes => {
          pushUndo({ nodes: prevNodes, edges: prev });
          return prevNodes;
        });
        setIsDirty(true);
        return prev.filter(e => e.id !== edgeId);
      });
    },
    [pushUndo]
  );

  const loadFlow = useCallback(
    (flow: Flow) => {
      const { nodes: nextNodes, edges: nextEdges } = flowToReactFlow(flow);
      setNodes(prevNodes => {
        setEdges(prevEdges => {
          pushUndo({ nodes: prevNodes, edges: prevEdges });
          return nextEdges;
        });
        return nextNodes;
      });
      setIsDirty(true);
    },
    [pushUndo]
  );

  const toFlow = useCallback(
    (
      metadata: Pick<Flow, 'id' | 'title' | 'layer' | 'updatedAt'> &
        Partial<Omit<Flow, 'id' | 'title' | 'layer' | 'updatedAt' | 'nodes' | 'edges'>>
    ): Flow => {
      return reactFlowToFlow(nodes, edges, metadata);
    },
    [nodes, edges]
  );

  const resetDirty = useCallback(() => {
    setIsDirty(false);
  }, []);

  return {
    nodes,
    edges,
    isDirty,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    deleteSelected,
    undo,
    redo,
    autoLayout,
    updateNode,
    deleteNode,
    updateEdge,
    deleteEdge,
    loadFlow,
    toFlow,
    resetDirty,
  };
}
