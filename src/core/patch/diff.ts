/**
 * FlowOps - Diff Generator
 * 
 * 2つのFlowオブジェクト間の差分を生成
 */

import { Flow, Node, Edge } from '../parser/schema';

export interface DiffEntry {
  type: 'add' | 'remove' | 'modify';
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface FlowDiff {
  entries: DiffEntry[];
  summary: {
    added: number;
    removed: number;
    modified: number;
  };
}

/**
 * 2つのオブジェクトの差分を再帰的に計算
 */
function diffObjects(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  path: string,
  entries: DiffEntry[]
): void {
  const oldKeys = new Set(Object.keys(oldObj));
  const newKeys = new Set(Object.keys(newObj));

  // 追加されたキー
  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      entries.push({
        type: 'add',
        path: `${path}/${key}`,
        newValue: newObj[key],
      });
    }
  }

  // 削除されたキー
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      entries.push({
        type: 'remove',
        path: `${path}/${key}`,
        oldValue: oldObj[key],
      });
    }
  }

  // 変更されたキー
  for (const key of oldKeys) {
    if (newKeys.has(key)) {
      const oldVal = oldObj[key];
      const newVal = newObj[key];

      if (typeof oldVal === 'object' && typeof newVal === 'object' && 
          oldVal !== null && newVal !== null &&
          !Array.isArray(oldVal) && !Array.isArray(newVal)) {
        // 再帰的に比較
        diffObjects(
          oldVal as Record<string, unknown>,
          newVal as Record<string, unknown>,
          `${path}/${key}`,
          entries
        );
      } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        entries.push({
          type: 'modify',
          path: `${path}/${key}`,
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    }
  }
}

/**
 * 2つのFlowオブジェクトの差分を計算
 */
export function diffFlows(oldFlow: Flow, newFlow: Flow): FlowDiff {
  const entries: DiffEntry[] = [];

  // 基本フィールドの比較
  if (oldFlow.title !== newFlow.title) {
    entries.push({
      type: 'modify',
      path: '/title',
      oldValue: oldFlow.title,
      newValue: newFlow.title,
    });
  }

  if (oldFlow.layer !== newFlow.layer) {
    entries.push({
      type: 'modify',
      path: '/layer',
      oldValue: oldFlow.layer,
      newValue: newFlow.layer,
    });
  }

  // ノードの比較
  diffObjects(
    oldFlow.nodes as Record<string, unknown>,
    newFlow.nodes as Record<string, unknown>,
    '/nodes',
    entries
  );

  // エッジの比較
  diffObjects(
    oldFlow.edges as Record<string, unknown>,
    newFlow.edges as Record<string, unknown>,
    '/edges',
    entries
  );

  // サマリを計算
  const summary = {
    added: entries.filter(e => e.type === 'add').length,
    removed: entries.filter(e => e.type === 'remove').length,
    modified: entries.filter(e => e.type === 'modify').length,
  };

  return { entries, summary };
}

/**
 * 差分をテキスト形式で表示
 */
export function formatDiffAsText(diff: FlowDiff): string {
  const lines: string[] = [];

  for (const entry of diff.entries) {
    switch (entry.type) {
      case 'add':
        lines.push(`+ ${entry.path}`);
        lines.push(`  ${JSON.stringify(entry.newValue, null, 2).split('\n').join('\n  ')}`);
        break;
      case 'remove':
        lines.push(`- ${entry.path}`);
        lines.push(`  ${JSON.stringify(entry.oldValue, null, 2).split('\n').join('\n  ')}`);
        break;
      case 'modify':
        lines.push(`~ ${entry.path}`);
        lines.push(`  - ${JSON.stringify(entry.oldValue)}`);
        lines.push(`  + ${JSON.stringify(entry.newValue)}`);
        break;
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 差分をHTMLフレンドリーなフォーマットで出力
 */
export function formatDiffAsHtml(diff: FlowDiff): string {
  const parts: string[] = [];

  parts.push('<div class="diff">');

  for (const entry of diff.entries) {
    switch (entry.type) {
      case 'add':
        parts.push(`<div class="diff-add">`);
        parts.push(`<span class="diff-path">+ ${escapeHtml(entry.path)}</span>`);
        parts.push(`<pre class="diff-value">${escapeHtml(JSON.stringify(entry.newValue, null, 2))}</pre>`);
        parts.push(`</div>`);
        break;
      case 'remove':
        parts.push(`<div class="diff-remove">`);
        parts.push(`<span class="diff-path">- ${escapeHtml(entry.path)}</span>`);
        parts.push(`<pre class="diff-value">${escapeHtml(JSON.stringify(entry.oldValue, null, 2))}</pre>`);
        parts.push(`</div>`);
        break;
      case 'modify':
        parts.push(`<div class="diff-modify">`);
        parts.push(`<span class="diff-path">~ ${escapeHtml(entry.path)}</span>`);
        parts.push(`<div class="diff-old"><pre>${escapeHtml(JSON.stringify(entry.oldValue, null, 2))}</pre></div>`);
        parts.push(`<div class="diff-new"><pre>${escapeHtml(JSON.stringify(entry.newValue, null, 2))}</pre></div>`);
        parts.push(`</div>`);
        break;
    }
  }

  parts.push('</div>');

  return parts.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
