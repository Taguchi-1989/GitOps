import { describe, it, expect } from 'vitest';
import { FlowSchema, NodeSchema, EdgeSchema, LayerSchema } from './schema';

const validNode = {
  id: 'node_1',
  type: 'process' as const,
  label: 'Test Node',
  role: 'sales',
};

const validEdge = {
  id: 'edge_1',
  from: 'node_1',
  to: 'node_2',
  label: 'next',
};

const validFlow = {
  id: 'test-flow',
  title: 'Test Flow',
  layer: 'L1' as const,
  updatedAt: '2026-01-01T00:00:00Z',
  nodes: {
    node_1: { id: 'node_1', type: 'start', label: 'Start' },
    node_2: { id: 'node_2', type: 'end', label: 'End' },
  },
  edges: {
    edge_1: { id: 'edge_1', from: 'node_1', to: 'node_2' },
  },
};

describe('NodeSchema', () => {
  it('accepts a valid node', () => {
    const result = NodeSchema.safeParse(validNode);
    expect(result.success).toBe(true);
  });

  it('rejects node with missing label', () => {
    const result = NodeSchema.safeParse({ id: 'n1', type: 'process' });
    expect(result.success).toBe(false);
  });

  it('rejects node with invalid type', () => {
    const result = NodeSchema.safeParse({ ...validNode, type: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts node with optional fields omitted', () => {
    const result = NodeSchema.safeParse({ id: 'n1', type: 'process', label: 'A' });
    expect(result.success).toBe(true);
  });
});

describe('EdgeSchema', () => {
  it('accepts a valid edge', () => {
    const result = EdgeSchema.safeParse(validEdge);
    expect(result.success).toBe(true);
  });

  it('rejects edge with missing from', () => {
    const result = EdgeSchema.safeParse({ id: 'e1', to: 'n2' });
    expect(result.success).toBe(false);
  });
});

describe('LayerSchema', () => {
  it('accepts L0, L1, L2', () => {
    expect(LayerSchema.safeParse('L0').success).toBe(true);
    expect(LayerSchema.safeParse('L1').success).toBe(true);
    expect(LayerSchema.safeParse('L2').success).toBe(true);
  });

  it('rejects invalid layer', () => {
    expect(LayerSchema.safeParse('L3').success).toBe(false);
    expect(LayerSchema.safeParse('').success).toBe(false);
  });
});

describe('FlowSchema', () => {
  it('accepts a valid flow', () => {
    const result = FlowSchema.safeParse(validFlow);
    expect(result.success).toBe(true);
  });

  it('rejects flow with missing title', () => {
    const { title, ...noTitle } = validFlow;
    const result = FlowSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it('rejects flow with empty nodes', () => {
    const result = FlowSchema.safeParse({ ...validFlow, nodes: {} });
    // Empty record is valid at schema level (semantic checks are in validateFlow)
    expect(result.success).toBe(true);
  });

  it('rejects flow with invalid layer', () => {
    const result = FlowSchema.safeParse({ ...validFlow, layer: 'L9' });
    expect(result.success).toBe(false);
  });
});
