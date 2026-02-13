import { describe, it, expect } from 'vitest';
import { applyPatches, applyPatchesToFlow, checkForbiddenPaths } from './apply';
import { PatchApplyError } from './apply';
import { sha256 } from './hash';
import type { Flow } from '../parser/schema';

const sampleFlow: Flow = {
  id: 'test-flow',
  title: 'Test Flow',
  layer: 'L1',
  updatedAt: '2026-01-01T00:00:00Z',
  nodes: {
    node_1: { id: 'node_1', type: 'start', label: 'Start' },
    node_2: { id: 'node_2', type: 'end', label: 'End' },
  },
  edges: {
    edge_1: { id: 'edge_1', from: 'node_1', to: 'node_2' },
  },
};

describe('applyPatches', () => {
  it('applies add operation', () => {
    const obj = { a: 1 };
    const result = applyPatches(obj, [{ op: 'add', path: '/b', value: 2 }]);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('applies remove operation', () => {
    const obj = { a: 1, b: 2 };
    const result = applyPatches(obj, [{ op: 'remove', path: '/b' }]);
    expect(result).toEqual({ a: 1 });
  });

  it('applies replace operation', () => {
    const obj = { a: 1 };
    const result = applyPatches(obj, [{ op: 'replace', path: '/a', value: 99 }]);
    expect(result).toEqual({ a: 99 });
  });

  it('throws on replace of nonexistent path', () => {
    const obj = { a: 1 };
    expect(() =>
      applyPatches(obj, [{ op: 'replace', path: '/missing', value: 99 }])
    ).toThrow(PatchApplyError);
  });

  it('does not mutate original object', () => {
    const obj = { a: 1 };
    applyPatches(obj, [{ op: 'add', path: '/b', value: 2 }]);
    expect(obj).toEqual({ a: 1 });
  });

  it('applies nested path operations', () => {
    const obj = { nodes: { n1: { label: 'old' } } };
    const result = applyPatches(obj, [
      { op: 'replace', path: '/nodes/n1/label', value: 'new' },
    ]);
    expect(result.nodes.n1.label).toBe('new');
  });
});

describe('applyPatchesToFlow', () => {
  it('applies patches and returns new hash', () => {
    const result = applyPatchesToFlow(sampleFlow, [
      { op: 'replace', path: '/title', value: 'Updated Title' },
    ]);
    expect(result.flow.title).toBe('Updated Title');
    expect(result.newHash).toBeTruthy();
  });

  it('throws on stale hash', () => {
    expect(() =>
      applyPatchesToFlow(sampleFlow, [{ op: 'replace', path: '/title', value: 'x' }], 'wrong-hash')
    ).toThrow('Flow has been modified');
  });

  it('succeeds with correct base hash', () => {
    const correctHash = sha256(JSON.stringify(sampleFlow));
    const result = applyPatchesToFlow(
      sampleFlow,
      [{ op: 'replace', path: '/title', value: 'New' }],
      correctHash
    );
    expect(result.flow.title).toBe('New');
  });
});

describe('checkForbiddenPaths', () => {
  it('detects /id modification', () => {
    const violations = checkForbiddenPaths(
      [{ op: 'replace', path: '/id', value: 'new-id' }],
      ['/id']
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('Forbidden');
  });

  it('allows non-forbidden paths', () => {
    const violations = checkForbiddenPaths(
      [{ op: 'replace', path: '/title', value: 'new-title' }],
      ['/id']
    );
    expect(violations).toHaveLength(0);
  });
});
