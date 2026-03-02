/**
 * Comprehensive tests for the parser module
 *
 * Covers: parseFlowYaml, stringifyFlow, validateFlow, getFlowSummary (index.ts),
 *         validateFlowIntegrity, detectFlowChanges (validateFlow.ts),
 *         flowToMermaid, getFlowSummary (toMermaid.ts)
 */

import { describe, it, expect, vi } from 'vitest';
import { parseFlowYaml, stringifyFlow, validateFlow, getFlowSummary, Flow } from './index';
import { validateFlowIntegrity, detectFlowChanges } from './validateFlow';
import { flowToMermaid, getFlowSummary as getMermaidSummary } from './toMermaid';

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function createMinimalFlow(overrides: Record<string, unknown> = {}): Flow {
  return {
    id: 'test-flow',
    title: 'Test Flow',
    layer: 'L1' as const,
    updatedAt: '2026-01-01T00:00:00Z',
    nodes: {
      start: { id: 'start', type: 'start' as const, label: 'Start' },
      end: { id: 'end', type: 'end' as const, label: 'End' },
    },
    edges: { e1: { id: 'e1', from: 'start', to: 'end' } },
    ...overrides,
  } as Flow;
}

const validYaml = `
id: test-flow
title: Test Flow
layer: L1
updatedAt: '2026-01-01T00:00:00Z'
nodes:
  start:
    id: start
    type: start
    label: Start
  end:
    id: end
    type: end
    label: End
edges:
  e1:
    id: e1
    from: start
    to: end
`;

// =============================================================
// parseFlowYaml (from index.ts)
// =============================================================
describe('parseFlowYaml', () => {
  it('should return success=true with a flow object for valid YAML', () => {
    const result = parseFlowYaml(validYaml);
    expect(result.success).toBe(true);
    expect(result.flow).toBeDefined();
    expect(result.flow!.id).toBe('test-flow');
    expect(result.flow!.title).toBe('Test Flow');
    expect(result.flow!.layer).toBe('L1');
    expect(Object.keys(result.flow!.nodes)).toHaveLength(2);
    expect(Object.keys(result.flow!.edges)).toHaveLength(1);
  });

  it('should return success=false with INVALID_SCHEMA for empty YAML', () => {
    const result = parseFlowYaml('');
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_SCHEMA')).toBe(true);
  });

  it('should return INVALID_SCHEMA for invalid YAML syntax', () => {
    const brokenYaml = `
id: test
  title: broken
    - this is: [invalid
`;
    const result = parseFlowYaml(brokenYaml);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_SCHEMA')).toBe(true);
  });

  it('should return schema errors when a required field is missing', () => {
    const yamlMissingTitle = `
id: test-flow
layer: L1
updatedAt: '2026-01-01T00:00:00Z'
nodes:
  start:
    id: start
    type: start
    label: Start
  end:
    id: end
    type: end
    label: End
edges:
  e1:
    id: e1
    from: start
    to: end
`;
    const result = parseFlowYaml(yamlMissingTitle);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_SCHEMA')).toBe(true);
  });

  it('should pass when filename matches flow id', () => {
    const result = parseFlowYaml(validYaml, 'test-flow.yaml');
    expect(result.success).toBe(true);
    expect(result.errors.filter(e => e.code === 'ID_MISMATCH')).toHaveLength(0);
  });

  it('should return ID_MISMATCH error when filename does not match flow id', () => {
    const result = parseFlowYaml(validYaml, 'wrong-name.yaml');
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.code === 'ID_MISMATCH')).toBe(true);
  });

  it('should skip ID check when no filename is provided', () => {
    const result = parseFlowYaml(validYaml);
    expect(result.errors.filter(e => e.code === 'ID_MISMATCH')).toHaveLength(0);
  });

  it('should include integrity errors from validateFlowIntegrity', () => {
    const yamlWithBadEdge = `
id: bad-edge-flow
title: Bad Edge
layer: L1
updatedAt: '2026-01-01T00:00:00Z'
nodes:
  start:
    id: start
    type: start
    label: Start
  end:
    id: end
    type: end
    label: End
edges:
  e1:
    id: e1
    from: start
    to: nonexistent
`;
    const result = parseFlowYaml(yamlWithBadEdge);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_NODE_REF')).toBe(true);
  });
});

// =============================================================
// stringifyFlow (from index.ts)
// =============================================================
describe('stringifyFlow', () => {
  it('should produce a YAML string from a Flow object', () => {
    const flow = createMinimalFlow();
    const yaml = stringifyFlow(flow);
    expect(typeof yaml).toBe('string');
    expect(yaml).toContain('id: test-flow');
    expect(yaml).toContain('title: Test Flow');
    expect(yaml).toContain('layer: L1');
  });

  it('should round-trip: stringify then parse returns equivalent data', () => {
    const flow = createMinimalFlow();
    const yaml = stringifyFlow(flow);
    const result = parseFlowYaml(yaml);
    expect(result.success).toBe(true);
    expect(result.flow!.id).toBe(flow.id);
    expect(result.flow!.title).toBe(flow.title);
    expect(result.flow!.layer).toBe(flow.layer);
    expect(Object.keys(result.flow!.nodes)).toEqual(Object.keys(flow.nodes));
    expect(Object.keys(result.flow!.edges)).toEqual(Object.keys(flow.edges));
  });
});

// =============================================================
// validateFlow (from index.ts)
// =============================================================
describe('validateFlow', () => {
  it('should return valid=true for a valid flow', () => {
    const flow = createMinimalFlow();
    const result = validateFlow(flow);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return errors for a flow with no start node', () => {
    const flow = createMinimalFlow({
      nodes: {
        process1: { id: 'process1', type: 'process' as const, label: 'Process' },
        end: { id: 'end', type: 'end' as const, label: 'End' },
      },
      edges: { e1: { id: 'e1', from: 'process1', to: 'end' } },
    });
    const result = validateFlow(flow);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_START_END')).toBe(true);
  });
});

// =============================================================
// getFlowSummary (from index.ts)
// =============================================================
describe('getFlowSummary (index)', () => {
  it('should return correct nodeCount and edgeCount', () => {
    const flow = createMinimalFlow();
    const summary = getFlowSummary(flow);
    expect(summary.nodeCount).toBe(2);
    expect(summary.edgeCount).toBe(1);
  });
});

// =============================================================
// validateFlowIntegrity (from validateFlow.ts)
// =============================================================
describe('validateFlowIntegrity', () => {
  it('should return valid=true and no errors for a valid flow', () => {
    const flow = createMinimalFlow();
    const result = validateFlowIntegrity(flow);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return MISSING_NODE_REF when edge references non-existent from node', () => {
    const flow = createMinimalFlow({
      edges: { e1: { id: 'e1', from: 'ghost', to: 'end' } },
    });
    const result = validateFlowIntegrity(flow);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_NODE_REF' && e.path?.includes('from'))).toBe(
      true
    );
  });

  it('should return MISSING_NODE_REF when edge references non-existent to node', () => {
    const flow = createMinimalFlow({
      edges: { e1: { id: 'e1', from: 'start', to: 'ghost' } },
    });
    const result = validateFlowIntegrity(flow);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_NODE_REF' && e.path?.includes('to'))).toBe(
      true
    );
  });

  it('should return MISSING_START_END when start node is missing', () => {
    const flow = createMinimalFlow({
      nodes: {
        process1: { id: 'process1', type: 'process' as const, label: 'Process' },
        end: { id: 'end', type: 'end' as const, label: 'End' },
      },
      edges: { e1: { id: 'e1', from: 'process1', to: 'end' } },
    });
    const result = validateFlowIntegrity(flow);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(e => e.code === 'MISSING_START_END' && e.message.includes('start'))
    ).toBe(true);
  });

  it('should return MISSING_START_END when end node is missing', () => {
    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start' as const, label: 'Start' },
        process1: { id: 'process1', type: 'process' as const, label: 'Process' },
      },
      edges: { e1: { id: 'e1', from: 'start', to: 'process1' } },
    });
    const result = validateFlowIntegrity(flow);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(e => e.code === 'MISSING_START_END' && e.message.includes('end'))
    ).toBe(true);
  });

  it('should return UNKNOWN_ROLE when dictionary has no matching role', () => {
    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start' as const, label: 'Start', role: 'unknown-role' },
        end: { id: 'end', type: 'end' as const, label: 'End' },
      },
    });
    const dictionary = {
      roles: {},
      systems: {},
    };
    const result = validateFlowIntegrity(flow, dictionary);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'UNKNOWN_ROLE')).toBe(true);
  });

  it('should return UNKNOWN_SYSTEM when dictionary has no matching system', () => {
    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start' as const, label: 'Start', system: 'unknown-sys' },
        end: { id: 'end', type: 'end' as const, label: 'End' },
      },
    });
    const dictionary = {
      roles: {},
      systems: {},
    };
    const result = validateFlowIntegrity(flow, dictionary);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'UNKNOWN_SYSTEM')).toBe(true);
  });

  it('should pass when dictionary contains the referenced role and system', () => {
    const flow = createMinimalFlow({
      nodes: {
        start: {
          id: 'start',
          type: 'start' as const,
          label: 'Start',
          role: 'admin',
          system: 'crm',
        },
        end: { id: 'end', type: 'end' as const, label: 'End' },
      },
    });
    const dictionary = {
      roles: { admin: { id: 'admin', name: 'Administrator' } },
      systems: { crm: { id: 'crm', name: 'CRM System' } },
    };
    const result = validateFlowIntegrity(flow, dictionary);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should skip dictionary check when no dictionary is provided', () => {
    const flow = createMinimalFlow({
      nodes: {
        start: {
          id: 'start',
          type: 'start' as const,
          label: 'Start',
          role: 'any-role',
          system: 'any-sys',
        },
        end: { id: 'end', type: 'end' as const, label: 'End' },
      },
    });
    const result = validateFlowIntegrity(flow);
    expect(result.valid).toBe(true);
    expect(result.errors.filter(e => e.code === 'UNKNOWN_ROLE')).toHaveLength(0);
    expect(result.errors.filter(e => e.code === 'UNKNOWN_SYSTEM')).toHaveLength(0);
  });
});

// =============================================================
// detectFlowChanges (from validateFlow.ts)
// =============================================================
describe('detectFlowChanges', () => {
  it('should return empty arrays for identical flows', () => {
    const flow = createMinimalFlow();
    const result = detectFlowChanges(flow, flow);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  it('should detect an added node', () => {
    const oldFlow = createMinimalFlow();
    const newFlow = createMinimalFlow({
      nodes: {
        ...oldFlow.nodes,
        process1: { id: 'process1', type: 'process' as const, label: 'New Process' },
      },
    });
    const result = detectFlowChanges(oldFlow, newFlow);
    expect(result.added).toContain('process1');
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  it('should detect a removed node', () => {
    const oldFlow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start' as const, label: 'Start' },
        end: { id: 'end', type: 'end' as const, label: 'End' },
        process1: { id: 'process1', type: 'process' as const, label: 'To Remove' },
      },
    });
    const newFlow = createMinimalFlow();
    const result = detectFlowChanges(oldFlow, newFlow);
    expect(result.removed).toContain('process1');
    expect(result.added).toHaveLength(0);
  });

  it('should detect a modified node (label change)', () => {
    const oldFlow = createMinimalFlow();
    const newFlow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start' as const, label: 'Modified Start' },
        end: { id: 'end', type: 'end' as const, label: 'End' },
      },
    });
    const result = detectFlowChanges(oldFlow, newFlow);
    expect(result.modified).toContain('start');
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });

  it('should detect multiple changes simultaneously', () => {
    const oldFlow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start' as const, label: 'Start' },
        end: { id: 'end', type: 'end' as const, label: 'End' },
        toRemove: { id: 'toRemove', type: 'process' as const, label: 'Remove Me' },
      },
    });
    const newFlow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start' as const, label: 'Changed Start' },
        end: { id: 'end', type: 'end' as const, label: 'End' },
        added: { id: 'added', type: 'process' as const, label: 'New Node' },
      },
    });
    const result = detectFlowChanges(oldFlow, newFlow);
    expect(result.added).toContain('added');
    expect(result.removed).toContain('toRemove');
    expect(result.modified).toContain('start');
  });
});

// =============================================================
// flowToMermaid (from toMermaid.ts)
// =============================================================
describe('flowToMermaid', () => {
  it('should contain "graph TD" by default', () => {
    const flow = createMinimalFlow();
    const mermaid = flowToMermaid(flow);
    expect(mermaid).toContain('graph TD');
  });

  it('should respect direction option "LR"', () => {
    const flow = createMinimalFlow();
    const mermaid = flowToMermaid(flow, { direction: 'LR' });
    expect(mermaid).toContain('graph LR');
    expect(mermaid).not.toContain('graph TD');
  });

  it('should include node labels', () => {
    const flow = createMinimalFlow();
    const mermaid = flowToMermaid(flow);
    expect(mermaid).toContain('"Start"');
    expect(mermaid).toContain('"End"');
  });

  it('should include edge connections', () => {
    const flow = createMinimalFlow();
    const mermaid = flowToMermaid(flow);
    expect(mermaid).toContain('start');
    expect(mermaid).toContain('-->');
    expect(mermaid).toContain('end');
  });

  it('should include styles by default', () => {
    const flow = createMinimalFlow();
    const mermaid = flowToMermaid(flow);
    expect(mermaid).toContain('classDef');
    expect(mermaid).toContain('startNode');
    expect(mermaid).toContain('endNode');
  });

  it('should exclude styles when includeStyles=false', () => {
    const flow = createMinimalFlow();
    const mermaid = flowToMermaid(flow, { includeStyles: false });
    expect(mermaid).not.toContain('classDef');
  });

  it('should include click handlers when includeClickHandlers=true', () => {
    const flow = createMinimalFlow();
    const mermaid = flowToMermaid(flow, { includeClickHandlers: true });
    expect(mermaid).toContain('click start callback');
    expect(mermaid).toContain('click end callback');
  });

  it('should use "([" and "])" shape for start nodes', () => {
    const flow = createMinimalFlow();
    const mermaid = flowToMermaid(flow);
    // start node should use stadium shape
    expect(mermaid).toMatch(/start\(\[/);
    expect(mermaid).toMatch(/\]\)/);
  });

  it('should use "{" and "}" shape for decision nodes', () => {
    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start' as const, label: 'Start' },
        decision1: { id: 'decision1', type: 'decision' as const, label: 'Decide' },
        end: { id: 'end', type: 'end' as const, label: 'End' },
      },
      edges: {
        e1: { id: 'e1', from: 'start', to: 'decision1' },
        e2: { id: 'e2', from: 'decision1', to: 'end' },
      },
    });
    const mermaid = flowToMermaid(flow);
    expect(mermaid).toMatch(/decision1\{/);
    expect(mermaid).toContain('}');
  });
});

// =============================================================
// getFlowSummary (from toMermaid.ts)
// =============================================================
describe('getFlowSummary (toMermaid)', () => {
  it('should count node types correctly', () => {
    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start' as const, label: 'Start' },
        process1: { id: 'process1', type: 'process' as const, label: 'P1' },
        process2: { id: 'process2', type: 'process' as const, label: 'P2' },
        decision1: { id: 'decision1', type: 'decision' as const, label: 'D1' },
        end: { id: 'end', type: 'end' as const, label: 'End' },
      },
    });
    const summary = getMermaidSummary(flow);
    expect(summary.nodeTypes.start).toBe(1);
    expect(summary.nodeTypes.process).toBe(2);
    expect(summary.nodeTypes.decision).toBe(1);
    expect(summary.nodeTypes.end).toBe(1);
    expect(summary.nodeCount).toBe(5);
  });

  it('should list unique roles', () => {
    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start' as const, label: 'Start', role: 'admin' },
        process1: { id: 'process1', type: 'process' as const, label: 'P1', role: 'operator' },
        process2: { id: 'process2', type: 'process' as const, label: 'P2', role: 'admin' },
        end: { id: 'end', type: 'end' as const, label: 'End' },
      },
    });
    const summary = getMermaidSummary(flow);
    expect(summary.roles).toContain('admin');
    expect(summary.roles).toContain('operator');
    expect(summary.roles).toHaveLength(2);
  });

  it('should list unique systems', () => {
    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start' as const, label: 'Start', system: 'crm' },
        process1: { id: 'process1', type: 'process' as const, label: 'P1', system: 'erp' },
        process2: { id: 'process2', type: 'process' as const, label: 'P2', system: 'crm' },
        end: { id: 'end', type: 'end' as const, label: 'End' },
      },
    });
    const summary = getMermaidSummary(flow);
    expect(summary.systems).toContain('crm');
    expect(summary.systems).toContain('erp');
    expect(summary.systems).toHaveLength(2);
  });
});
