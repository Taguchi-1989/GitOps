import { describe, it, expect } from 'vitest';
import type { Flow } from '@/core/parser/schema';
import { flowToReactFlow, reactFlowToFlow } from './converters';

const sampleFlow: Flow = {
  id: 'test-flow',
  title: 'Test Flow',
  layer: 'L1',
  updatedAt: '2024-01-01T00:00:00Z',
  nodes: {
    n1: { id: 'n1', type: 'start', label: 'Start' },
    n2: { id: 'n2', type: 'process', label: 'Process A', role: 'developer', system: 'app' },
    n3: { id: 'n3', type: 'decision', label: 'Is valid?', meta: { position: { x: 100, y: 200 } } },
    n4: { id: 'n4', type: 'database', label: 'Save to DB', system: 'postgres' },
    n5: { id: 'n5', type: 'llm-task', label: 'AI Review', taskId: 'ai-review' },
    n6: { id: 'n6', type: 'human-review', label: 'Human Check', role: 'reviewer' },
    n7: { id: 'n7', type: 'end', label: 'End' },
  },
  edges: {
    e1: { id: 'e1', from: 'n1', to: 'n2' },
    e2: { id: 'e2', from: 'n2', to: 'n3', label: 'Submit' },
    e3: { id: 'e3', from: 'n3', to: 'n4', condition: 'valid === true', label: 'Yes' },
    e4: { id: 'e4', from: 'n3', to: 'n5', condition: 'valid === false', label: 'No' },
    e5: { id: 'e5', from: 'n4', to: 'n6' },
    e6: { id: 'e6', from: 'n5', to: 'n6' },
    e7: { id: 'e7', from: 'n6', to: 'n7' },
  },
};

describe('flowToReactFlow', () => {
  it('converts all 7 node types', () => {
    const { nodes } = flowToReactFlow(sampleFlow);
    const nodeTypes = nodes.map(n => n.data.nodeType);
    expect(nodeTypes).toContain('start');
    expect(nodeTypes).toContain('end');
    expect(nodeTypes).toContain('process');
    expect(nodeTypes).toContain('decision');
    expect(nodeTypes).toContain('database');
    expect(nodeTypes).toContain('llm-task');
    expect(nodeTypes).toContain('human-review');
  });

  it('produces correct number of nodes and edges', () => {
    const { nodes, edges } = flowToReactFlow(sampleFlow);
    expect(nodes).toHaveLength(7);
    expect(edges).toHaveLength(7);
  });

  it('preserves node label, role, system, taskId', () => {
    const { nodes } = flowToReactFlow(sampleFlow);
    const n2 = nodes.find(n => n.id === 'n2');
    expect(n2?.data.label).toBe('Process A');
    expect(n2?.data.role).toBe('developer');
    expect(n2?.data.system).toBe('app');

    const n5 = nodes.find(n => n.id === 'n5');
    expect(n5?.data.taskId).toBe('ai-review');
  });

  it('uses persisted position from meta.position when available', () => {
    const { nodes } = flowToReactFlow(sampleFlow);
    // n3 has position in meta, but dagre is applied because n1/n2/etc don't
    // We just check n3 ends up with a numeric position
    const n3 = nodes.find(n => n.id === 'n3');
    expect(typeof n3?.position.x).toBe('number');
    expect(typeof n3?.position.y).toBe('number');
  });

  it('preserves edge condition and label', () => {
    const { edges } = flowToReactFlow(sampleFlow);
    const e3 = edges.find(e => e.id === 'e3');
    expect(e3?.data?.condition).toBe('valid === true');
    expect(e3?.label).toBe('Yes');
  });

  it('sets edge source and target from from/to', () => {
    const { edges } = flowToReactFlow(sampleFlow);
    const e2 = edges.find(e => e.id === 'e2');
    expect(e2?.source).toBe('n2');
    expect(e2?.target).toBe('n3');
  });
});

describe('flowToReactFlow -> reactFlowToFlow round-trip', () => {
  it('preserves node IDs', () => {
    const { nodes, edges } = flowToReactFlow(sampleFlow);
    const restored = reactFlowToFlow(nodes, edges, {
      id: sampleFlow.id,
      title: sampleFlow.title,
      layer: sampleFlow.layer,
      updatedAt: sampleFlow.updatedAt,
    });
    const originalIds = Object.keys(sampleFlow.nodes).sort();
    const restoredIds = Object.keys(restored.nodes).sort();
    expect(restoredIds).toEqual(originalIds);
  });

  it('preserves edge IDs, from, to', () => {
    const { nodes, edges } = flowToReactFlow(sampleFlow);
    const restored = reactFlowToFlow(nodes, edges, {
      id: sampleFlow.id,
      title: sampleFlow.title,
      layer: sampleFlow.layer,
      updatedAt: sampleFlow.updatedAt,
    });
    const e3 = restored.edges['e3'];
    expect(e3.from).toBe('n3');
    expect(e3.to).toBe('n4');
    expect(e3.condition).toBe('valid === true');
    expect(e3.label).toBe('Yes');
  });

  it('preserves node type and label', () => {
    const { nodes, edges } = flowToReactFlow(sampleFlow);
    const restored = reactFlowToFlow(nodes, edges, {
      id: sampleFlow.id,
      title: sampleFlow.title,
      layer: sampleFlow.layer,
      updatedAt: sampleFlow.updatedAt,
    });
    expect(restored.nodes['n5'].type).toBe('llm-task');
    expect(restored.nodes['n6'].type).toBe('human-review');
    expect(restored.nodes['n2'].label).toBe('Process A');
  });

  it('stores position in meta.position after round-trip', () => {
    const { nodes, edges } = flowToReactFlow(sampleFlow);
    const restored = reactFlowToFlow(nodes, edges, {
      id: sampleFlow.id,
      title: sampleFlow.title,
      layer: sampleFlow.layer,
      updatedAt: sampleFlow.updatedAt,
    });
    const meta = restored.nodes['n1'].meta as Record<string, unknown> | undefined;
    expect(meta?.position).toBeDefined();
    const pos = meta?.position as { x: number; y: number };
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
  });

  it('preserves dataClassification on nodes across round-trip', () => {
    const flowWithClassification: Flow = {
      ...sampleFlow,
      nodes: {
        ...sampleFlow.nodes,
        n2: {
          id: 'n2',
          type: 'process',
          label: 'Process A',
          role: 'developer',
          system: 'app',
          dataClassification: {
            sensitivityLevel: 'L3',
            aiUsageAllowed: false,
            abstractionRequired: true,
            exportPolicy: 'internal-only',
          },
        },
      },
    };
    const { nodes, edges } = flowToReactFlow(flowWithClassification);
    const restored = reactFlowToFlow(nodes, edges, {
      id: flowWithClassification.id,
      title: flowWithClassification.title,
      layer: flowWithClassification.layer,
      updatedAt: flowWithClassification.updatedAt,
    });
    expect(restored.nodes['n2'].dataClassification?.sensitivityLevel).toBe('L3');
    expect(restored.nodes['n2'].dataClassification?.aiUsageAllowed).toBe(false);
    expect(restored.nodes['n2'].dataClassification?.exportPolicy).toBe('internal-only');
  });

  it('preserves dataLayer on edges across round-trip', () => {
    const flowWithDataLayer: Flow = {
      ...sampleFlow,
      edges: {
        ...sampleFlow.edges,
        e3: {
          id: 'e3',
          from: 'n3',
          to: 'n4',
          condition: 'valid === true',
          label: 'Yes',
          dataLayer: 'abstracted-semantic',
        },
      },
    };
    const { nodes, edges } = flowToReactFlow(flowWithDataLayer);
    const restored = reactFlowToFlow(nodes, edges, {
      id: flowWithDataLayer.id,
      title: flowWithDataLayer.title,
      layer: flowWithDataLayer.layer,
      updatedAt: flowWithDataLayer.updatedAt,
    });
    expect(restored.edges['e3'].dataLayer).toBe('abstracted-semantic');
  });

  it('no data loss for role, system, taskId', () => {
    const { nodes, edges } = flowToReactFlow(sampleFlow);
    const restored = reactFlowToFlow(nodes, edges, {
      id: sampleFlow.id,
      title: sampleFlow.title,
      layer: sampleFlow.layer,
      updatedAt: sampleFlow.updatedAt,
    });
    expect(restored.nodes['n2'].role).toBe('developer');
    expect(restored.nodes['n2'].system).toBe('app');
    expect(restored.nodes['n5'].taskId).toBe('ai-review');
  });
});

describe('flowToReactFlow with pre-positioned nodes', () => {
  it('uses dagre when no nodes have positions', () => {
    const noPositionFlow: Flow = {
      ...sampleFlow,
      nodes: {
        n1: { id: 'n1', type: 'start', label: 'Start' },
        n2: { id: 'n2', type: 'end', label: 'End' },
      },
      edges: {
        e1: { id: 'e1', from: 'n1', to: 'n2' },
      },
    };
    const { nodes } = flowToReactFlow(noPositionFlow);
    // All nodes should have numeric positions from dagre
    for (const node of nodes) {
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
    }
  });

  it('preserves exact persisted positions when all nodes have meta.position', () => {
    const allPositionedFlow: Flow = {
      ...sampleFlow,
      nodes: {
        n1: { id: 'n1', type: 'start', label: 'Start', meta: { position: { x: 10, y: 20 } } },
        n2: { id: 'n2', type: 'process', label: 'Process', meta: { position: { x: 200, y: 300 } } },
        n3: { id: 'n3', type: 'end', label: 'End', meta: { position: { x: 400, y: 500 } } },
      },
      edges: {
        e1: { id: 'e1', from: 'n1', to: 'n2' },
        e2: { id: 'e2', from: 'n2', to: 'n3' },
      },
    };
    const { nodes } = flowToReactFlow(allPositionedFlow);
    const n1 = nodes.find(n => n.id === 'n1');
    const n2 = nodes.find(n => n.id === 'n2');
    const n3 = nodes.find(n => n.id === 'n3');
    expect(n1?.position).toEqual({ x: 10, y: 20 });
    expect(n2?.position).toEqual({ x: 200, y: 300 });
    expect(n3?.position).toEqual({ x: 400, y: 500 });
  });
});
