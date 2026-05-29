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
    expect(() => applyPatches(obj, [{ op: 'replace', path: '/missing', value: 99 }])).toThrow(
      PatchApplyError
    );
  });

  it('does not mutate original object', () => {
    const obj = { a: 1 };
    applyPatches(obj, [{ op: 'add', path: '/b', value: 2 }]);
    expect(obj).toEqual({ a: 1 });
  });

  it('applies nested path operations', () => {
    const obj = { nodes: { n1: { label: 'old' } } };
    const result = applyPatches(obj, [{ op: 'replace', path: '/nodes/n1/label', value: 'new' }]);
    expect(result.nodes.n1.label).toBe('new');
  });

  it('creates intermediate arrays when the next segment is numeric', () => {
    const obj: Record<string, unknown> = {};
    const result = applyPatches(obj, [{ op: 'add', path: '/items/0', value: 'first' }]);
    expect(result).toEqual({ items: ['first'] });
  });

  it('applies move operation', () => {
    const obj = { a: { x: 1 }, b: {} };
    const result = applyPatches(obj, [{ op: 'move', from: '/a/x', path: '/b/y' }]);
    expect(result).toEqual({ a: {}, b: { y: 1 } });
  });

  it('throws when move is missing the "from" field', () => {
    const obj = { a: 1 };
    expect(() => applyPatches(obj, [{ op: 'move', path: '/b' }])).toThrow('requires "from"');
  });

  it('throws when move source path does not exist', () => {
    const obj = { a: 1 };
    expect(() => applyPatches(obj, [{ op: 'move', from: '/missing', path: '/b' }])).toThrow(
      'Cannot move'
    );
  });

  it('applies copy operation with a deep clone', () => {
    const obj: Record<string, any> = { a: { x: 1 }, b: {} };
    const result = applyPatches(obj, [{ op: 'copy', from: '/a', path: '/b/clone' }]);
    expect(result).toEqual({ a: { x: 1 }, b: { clone: { x: 1 } } });
    // 元の値と参照が共有されていないこと
    result.b.clone.x = 99;
    expect(result.a.x).toBe(1);
  });

  it('throws when copy is missing the "from" field', () => {
    const obj = { a: 1 };
    expect(() => applyPatches(obj, [{ op: 'copy', path: '/b' }])).toThrow('requires "from"');
  });

  it('throws when copy source path does not exist', () => {
    const obj = { a: 1 };
    expect(() => applyPatches(obj, [{ op: 'copy', from: '/missing', path: '/b' }])).toThrow(
      'Cannot copy'
    );
  });

  it('passes a test operation when values match', () => {
    const obj = { a: 1 };
    const result = applyPatches(obj, [{ op: 'test', path: '/a', value: 1 }]);
    expect(result).toEqual({ a: 1 });
  });

  it('throws when a test operation value does not match', () => {
    const obj = { a: 1 };
    expect(() => applyPatches(obj, [{ op: 'test', path: '/a', value: 2 }])).toThrow('Test failed');
  });

  it('throws on an unknown operation', () => {
    const obj = { a: 1 };
    expect(() => applyPatches(obj, [{ op: 'invalid' as never, path: '/a', value: 2 }])).toThrow(
      'Unknown operation'
    );
  });

  it('throws on a JSON Pointer that does not start with /', () => {
    const obj = { a: 1 };
    expect(() => applyPatches(obj, [{ op: 'add', path: 'a', value: 1 }])).toThrow(
      'must start with /'
    );
  });

  it('removes an element from an array by index', () => {
    const obj = { items: ['a', 'b', 'c'] };
    const result = applyPatches(obj, [{ op: 'remove', path: '/items/1' }]);
    expect(result.items).toEqual(['a', 'c']);
  });

  it('throws when removing an array element with a non-numeric index', () => {
    const obj = { items: ['a', 'b'] };
    expect(() => applyPatches(obj, [{ op: 'remove', path: '/items/x' }])).toThrow(
      'Invalid array index'
    );
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

  it('detects nested forbidden path modifications', () => {
    const violations = checkForbiddenPaths(
      [{ op: 'replace', path: '/id/sub', value: 'x' }],
      ['/id']
    );
    expect(violations).toHaveLength(1);
  });

  it('detects forbidden path access via the "from" field', () => {
    const violations = checkForbiddenPaths([{ op: 'move', from: '/id', path: '/title' }], ['/id']);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("via 'from'");
  });

  it('uses the default forbidden paths (/id) when none are provided', () => {
    const violations = checkForbiddenPaths([{ op: 'replace', path: '/id', value: 'x' }]);
    expect(violations).toHaveLength(1);
  });
});
