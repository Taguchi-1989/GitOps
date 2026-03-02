import { describe, it, expect } from 'vitest';
import { diffFlows, formatDiffAsText, formatDiffAsHtml } from './diff';
import type { Flow } from '../parser/schema';

function createFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: 'test',
    title: 'Test',
    layer: 'L1',
    updatedAt: '2026-01-01T00:00:00Z',
    nodes: {
      s: { id: 's', type: 'start', label: 'Start' },
      e: { id: 'e', type: 'end', label: 'End' },
    },
    edges: { e1: { id: 'e1', from: 's', to: 'e' } },
    ...overrides,
  } as Flow;
}

// -------------------------------------------------------
// diffFlows
// -------------------------------------------------------
describe('diffFlows', () => {
  it('returns empty entries and zero summary for identical flows', () => {
    const flow = createFlow();
    const diff = diffFlows(flow, flow);

    expect(diff.entries).toEqual([]);
    expect(diff.summary).toEqual({ added: 0, removed: 0, modified: 0 });
  });

  it('detects a title change as modify at /title', () => {
    const oldFlow = createFlow();
    const newFlow = createFlow({ title: 'Updated' });
    const diff = diffFlows(oldFlow, newFlow);

    const titleEntry = diff.entries.find(e => e.path === '/title');
    expect(titleEntry).toBeDefined();
    expect(titleEntry!.type).toBe('modify');
    expect(titleEntry!.oldValue).toBe('Test');
    expect(titleEntry!.newValue).toBe('Updated');
  });

  it('detects a layer change as modify at /layer', () => {
    const oldFlow = createFlow();
    const newFlow = createFlow({ layer: 'L2' });
    const diff = diffFlows(oldFlow, newFlow);

    const layerEntry = diff.entries.find(e => e.path === '/layer');
    expect(layerEntry).toBeDefined();
    expect(layerEntry!.type).toBe('modify');
    expect(layerEntry!.oldValue).toBe('L1');
    expect(layerEntry!.newValue).toBe('L2');
  });

  it('detects an added node at /nodes/newNode', () => {
    const oldFlow = createFlow();
    const newFlow = createFlow({
      nodes: {
        s: { id: 's', type: 'start', label: 'Start' },
        e: { id: 'e', type: 'end', label: 'End' },
        newNode: { id: 'newNode', type: 'process', label: 'New' },
      },
    });
    const diff = diffFlows(oldFlow, newFlow);

    const addEntry = diff.entries.find(e => e.path === '/nodes/newNode');
    expect(addEntry).toBeDefined();
    expect(addEntry!.type).toBe('add');
    expect(addEntry!.newValue).toEqual({ id: 'newNode', type: 'process', label: 'New' });
  });

  it('detects a removed node at /nodes/s', () => {
    const oldFlow = createFlow();
    const newFlow = createFlow({
      nodes: {
        e: { id: 'e', type: 'end', label: 'End' },
      },
    });
    const diff = diffFlows(oldFlow, newFlow);

    const removeEntry = diff.entries.find(e => e.path === '/nodes/s');
    expect(removeEntry).toBeDefined();
    expect(removeEntry!.type).toBe('remove');
    expect(removeEntry!.oldValue).toEqual({ id: 's', type: 'start', label: 'Start' });
  });

  it('detects a modified node label as a nested modify', () => {
    const oldFlow = createFlow();
    const newFlow = createFlow({
      nodes: {
        s: { id: 's', type: 'start', label: 'Begin' },
        e: { id: 'e', type: 'end', label: 'End' },
      },
    });
    const diff = diffFlows(oldFlow, newFlow);

    const labelEntry = diff.entries.find(e => e.path === '/nodes/s/label');
    expect(labelEntry).toBeDefined();
    expect(labelEntry!.type).toBe('modify');
    expect(labelEntry!.oldValue).toBe('Start');
    expect(labelEntry!.newValue).toBe('Begin');
  });

  it('detects an added edge', () => {
    const oldFlow = createFlow();
    const newFlow = createFlow({
      edges: {
        e1: { id: 'e1', from: 's', to: 'e' },
        e2: { id: 'e2', from: 'e', to: 's' },
      },
    });
    const diff = diffFlows(oldFlow, newFlow);

    const addEntry = diff.entries.find(e => e.path === '/edges/e2');
    expect(addEntry).toBeDefined();
    expect(addEntry!.type).toBe('add');
  });

  it('detects a removed edge', () => {
    const oldFlow = createFlow();
    const newFlow = createFlow({
      edges: {},
    });
    const diff = diffFlows(oldFlow, newFlow);

    const removeEntry = diff.entries.find(e => e.path === '/edges/e1');
    expect(removeEntry).toBeDefined();
    expect(removeEntry!.type).toBe('remove');
  });

  it('produces summary counts that match entries', () => {
    const oldFlow = createFlow();
    const newFlow = createFlow({
      title: 'Changed',
      nodes: {
        s: { id: 's', type: 'start', label: 'Start' },
        e: { id: 'e', type: 'end', label: 'End' },
        p: { id: 'p', type: 'process', label: 'Process' },
      },
      edges: {},
    });
    const diff = diffFlows(oldFlow, newFlow);

    const addCount = diff.entries.filter(e => e.type === 'add').length;
    const removeCount = diff.entries.filter(e => e.type === 'remove').length;
    const modifyCount = diff.entries.filter(e => e.type === 'modify').length;

    expect(diff.summary.added).toBe(addCount);
    expect(diff.summary.removed).toBe(removeCount);
    expect(diff.summary.modified).toBe(modifyCount);
  });

  it('recursively compares nested object differences', () => {
    const oldFlow = createFlow();
    const newFlow = createFlow({
      nodes: {
        s: { id: 's', type: 'process', label: 'Start' },
        e: { id: 'e', type: 'end', label: 'Finish' },
      },
    });
    const diff = diffFlows(oldFlow, newFlow);

    const typePath = diff.entries.find(e => e.path === '/nodes/s/type');
    const labelPath = diff.entries.find(e => e.path === '/nodes/e/label');

    expect(typePath).toBeDefined();
    expect(typePath!.type).toBe('modify');
    expect(typePath!.oldValue).toBe('start');
    expect(typePath!.newValue).toBe('process');

    expect(labelPath).toBeDefined();
    expect(labelPath!.type).toBe('modify');
    expect(labelPath!.oldValue).toBe('End');
    expect(labelPath!.newValue).toBe('Finish');
  });
});

// -------------------------------------------------------
// formatDiffAsText
// -------------------------------------------------------
describe('formatDiffAsText', () => {
  it('prefixes add entries with "+"', () => {
    const diff = diffFlows(
      createFlow(),
      createFlow({
        nodes: {
          s: { id: 's', type: 'start', label: 'Start' },
          e: { id: 'e', type: 'end', label: 'End' },
          n: { id: 'n', type: 'process', label: 'New' },
        },
      })
    );
    const text = formatDiffAsText(diff);
    expect(text).toContain('+ /nodes/n');
  });

  it('prefixes remove entries with "-"', () => {
    const diff = diffFlows(createFlow(), createFlow({ edges: {} }));
    const text = formatDiffAsText(diff);
    expect(text).toContain('- /edges/e1');
  });

  it('prefixes modify entries with "~" and shows old/new values', () => {
    const diff = diffFlows(createFlow(), createFlow({ title: 'New Title' }));
    const text = formatDiffAsText(diff);
    expect(text).toContain('~ /title');
    expect(text).toContain('"Test"');
    expect(text).toContain('"New Title"');
  });

  it('returns an empty string for an empty diff', () => {
    const diff = diffFlows(createFlow(), createFlow());
    const text = formatDiffAsText(diff);
    expect(text).toBe('');
  });
});

// -------------------------------------------------------
// formatDiffAsHtml
// -------------------------------------------------------
describe('formatDiffAsHtml', () => {
  it('contains "diff-add" class for additions', () => {
    const diff = diffFlows(
      createFlow(),
      createFlow({
        nodes: {
          s: { id: 's', type: 'start', label: 'Start' },
          e: { id: 'e', type: 'end', label: 'End' },
          x: { id: 'x', type: 'process', label: 'X' },
        },
      })
    );
    const html = formatDiffAsHtml(diff);
    expect(html).toContain('diff-add');
  });

  it('contains "diff-remove" class for removals', () => {
    const diff = diffFlows(createFlow(), createFlow({ edges: {} }));
    const html = formatDiffAsHtml(diff);
    expect(html).toContain('diff-remove');
  });

  it('contains "diff-modify" class for modifications', () => {
    const diff = diffFlows(createFlow(), createFlow({ title: 'Changed' }));
    const html = formatDiffAsHtml(diff);
    expect(html).toContain('diff-modify');
  });

  it('escapes HTML special characters (< > & " \')', () => {
    const diff = diffFlows(
      createFlow({ title: '<script>alert("xss")&</script>' }),
      createFlow({ title: "safe'title" })
    );
    const html = formatDiffAsHtml(diff);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&#039;');
  });

  it('wraps output in a div with class "diff"', () => {
    const diff = diffFlows(createFlow(), createFlow({ title: 'X' }));
    const html = formatDiffAsHtml(diff);

    expect(html).toMatch(/^<div class="diff">/);
    expect(html).toMatch(/<\/div>$/);
  });

  it('produces only the wrapper div for an empty diff', () => {
    const diff = diffFlows(createFlow(), createFlow());
    const html = formatDiffAsHtml(diff);

    expect(html).toBe('<div class="diff">\n</div>');
  });
});
