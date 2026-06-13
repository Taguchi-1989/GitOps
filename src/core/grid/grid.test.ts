/**
 * FlowOps - Grid Module Tests
 */

import { describe, it, expect } from 'vitest';
import type { Flow } from '@/core/parser/schema';
import { applyPatches } from '@/core/patch';
import {
  flowToNodeRows,
  flowToEdgeRows,
  rowsToFlow,
  validateRows,
  hasBlockingErrors,
  buildJsonPatch,
  nodeRowsToCsv,
  edgeRowsToCsv,
  parseNodeCsv,
  parseEdgeCsv,
} from './index';

function sampleFlow(): Flow {
  return {
    id: 'f1',
    title: 'テストフロー',
    layer: 'L1',
    updatedAt: '2026-01-01T00:00:00Z',
    nodes: {
      n1: { id: 'n1', type: 'start', label: '開始' },
      n2: {
        id: 'n2',
        type: 'process',
        label: '処理',
        role: 'worker',
        meta: { description: '説明テキスト', custom: 'keep-me' },
        dataClassification: {
          sensitivityLevel: 'L2',
          aiUsageAllowed: true,
          abstractionRequired: false,
          exportPolicy: 'internal-only',
        },
      },
      n3: { id: 'n3', type: 'end', label: '終了' },
    },
    edges: {
      e1: { id: 'e1', from: 'n1', to: 'n2' },
      e2: { id: 'e2', from: 'n2', to: 'n3', label: '完了', dataLayer: 'output-artifact' },
    },
  };
}

describe('mapping round-trip', () => {
  it('preserves the flow incl. dataClassification and extra meta keys', () => {
    const flow = sampleFlow();
    const nodeRows = flowToNodeRows(flow);
    const edgeRows = flowToEdgeRows(flow);
    const rebuilt = rowsToFlow(flow, nodeRows, edgeRows);
    expect(rebuilt).toEqual(flow);
  });

  it('maps description to/from node.meta.description', () => {
    const flow = sampleFlow();
    const rows = flowToNodeRows(flow);
    expect(rows.find(r => r.id === 'n2')!.description).toBe('説明テキスト');
  });
});

describe('validateRows', () => {
  it('passes a valid flow (only the start/end warning is absent)', () => {
    const flow = sampleFlow();
    const errors = validateRows(flowToNodeRows(flow), flowToEdgeRows(flow));
    expect(hasBlockingErrors(errors)).toBe(false);
  });

  it('flags duplicate node ids, bad type and missing label', () => {
    const errors = validateRows(
      [
        {
          id: 'a',
          type: 'start',
          label: '開始',
          role: '',
          system: '',
          taskId: '',
          description: '',
        },
        { id: 'a', type: 'bogus', label: '', role: '', system: '', taskId: '', description: '' },
        { id: 'z', type: 'end', label: '終了', role: '', system: '', taskId: '', description: '' },
      ],
      []
    );
    expect(errors.some(e => e.field === 'id' && e.message.includes('重複'))).toBe(true);
    expect(errors.some(e => e.rowIndex === 1 && e.field === 'type')).toBe(true);
    expect(errors.some(e => e.rowIndex === 1 && e.field === 'label')).toBe(true);
  });

  it('flags edges referencing non-existent nodes (MISSING_NODE_REF)', () => {
    const errors = validateRows(
      [
        {
          id: 'n1',
          type: 'start',
          label: '開始',
          role: '',
          system: '',
          taskId: '',
          description: '',
        },
        { id: 'n2', type: 'end', label: '終了', role: '', system: '', taskId: '', description: '' },
      ],
      [{ id: 'e1', from: 'n1', to: 'ghost', label: '', condition: '', dataLayer: '' }]
    );
    const refErr = errors.find(e => e.scope === 'edge' && e.field === 'to');
    expect(refErr?.message).toContain('存在しないノード');
    expect(refErr?.severity).toBe('error');
  });

  it('warns (not blocks) when start/end nodes are missing', () => {
    const errors = validateRows(
      [
        {
          id: 'p',
          type: 'process',
          label: '処理',
          role: '',
          system: '',
          taskId: '',
          description: '',
        },
      ],
      []
    );
    const warn = errors.find(e => e.scope === 'flow');
    expect(warn?.severity).toBe('warning');
    expect(hasBlockingErrors(errors)).toBe(false);
  });

  it('rejects an invalid dataLayer', () => {
    const errors = validateRows(
      [
        {
          id: 'n1',
          type: 'start',
          label: '開始',
          role: '',
          system: '',
          taskId: '',
          description: '',
        },
        { id: 'n2', type: 'end', label: '終了', role: '', system: '', taskId: '', description: '' },
      ],
      [{ id: 'e1', from: 'n1', to: 'n2', label: '', condition: '', dataLayer: 'nope' }]
    );
    expect(errors.some(e => e.field === 'dataLayer')).toBe(true);
  });
});

describe('buildJsonPatch', () => {
  it('produces an empty patch when nothing changes', () => {
    const flow = sampleFlow();
    const same = rowsToFlow(flow, flowToNodeRows(flow), flowToEdgeRows(flow));
    expect(buildJsonPatch(flow, same)).toEqual([]);
  });

  it('round-trips: applyPatches(old, buildJsonPatch(old,new)) deep-equals new', () => {
    const flow = sampleFlow();
    const nodeRows = flowToNodeRows(flow);
    // modify a label, add a node
    nodeRows.find(r => r.id === 'n2')!.label = '処理(改)';
    nodeRows.push({
      id: 'n4',
      type: 'process',
      label: '追加',
      role: '',
      system: '',
      taskId: '',
      description: '',
    });
    const edgeRows = flowToEdgeRows(flow);
    const newFlow = rowsToFlow(flow, nodeRows, edgeRows);

    const patches = buildJsonPatch(flow, newFlow);
    expect(patches.length).toBeGreaterThan(0);
    const applied = applyPatches(flow, patches);
    expect(applied).toEqual(newFlow);
  });

  it('handles removals', () => {
    const flow = sampleFlow();
    const nodeRows = flowToNodeRows(flow).filter(r => r.id !== 'n3');
    const edgeRows = flowToEdgeRows(flow).filter(r => r.id !== 'e2');
    const newFlow = rowsToFlow(flow, nodeRows, edgeRows);
    const patches = buildJsonPatch(flow, newFlow);
    expect(patches.some(p => p.op === 'remove' && p.path === '/nodes/n3')).toBe(true);
    expect(applyPatches(flow, patches)).toEqual(newFlow);
  });
});

describe('CSV round-trip', () => {
  it('node export -> import is identity', () => {
    const flow = sampleFlow();
    const rows = flowToNodeRows(flow);
    const parsed = parseNodeCsv(nodeRowsToCsv(rows));
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual(rows);
  });

  it('edge export -> import is identity', () => {
    const flow = sampleFlow();
    const rows = flowToEdgeRows(flow);
    const parsed = parseEdgeCsv(edgeRowsToCsv(rows));
    expect(parsed.rows).toEqual(rows);
  });

  it('neutralizes and restores injection-prone values (no-op round-trip)', () => {
    const rows = [
      {
        id: 'n1',
        type: 'process',
        label: '=cmd()',
        role: '',
        system: '',
        taskId: '',
        description: '+danger',
      },
    ];
    const csv = nodeRowsToCsv(rows);
    expect(csv).toContain("'=cmd()"); // guarded in the file
    const parsed = parseNodeCsv(csv);
    expect(parsed.rows[0].label).toBe('=cmd()'); // restored on import
    expect(parsed.rows[0].description).toBe('+danger');
  });
});
