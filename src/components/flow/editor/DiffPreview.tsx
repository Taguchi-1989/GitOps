'use client';

import React, { useMemo } from 'react';
import { Check, X, Plus, Minus, Edit2 } from 'lucide-react';
import type { Flow } from '@/core/parser/schema';

interface DiffPreviewProps {
  currentFlow: Flow;
  proposedFlow: Flow;
  onApply: () => void;
  onReject: () => void;
}

interface NodeDiff {
  id: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  label: string;
  type: string;
}

interface EdgeDiff {
  id: string;
  status: 'added' | 'removed' | 'unchanged';
  label: string;
}

function computeDiff(current: Flow, proposed: Flow): { nodes: NodeDiff[]; edges: EdgeDiff[] } {
  const currentNodeIds = new Set(Object.keys(current.nodes));
  const proposedNodeIds = new Set(Object.keys(proposed.nodes));

  const nodes: NodeDiff[] = [];

  // Added nodes
  for (const id of proposedNodeIds) {
    if (!currentNodeIds.has(id)) {
      const node = proposed.nodes[id];
      nodes.push({ id, status: 'added', label: node.label, type: node.type });
    }
  }

  // Removed nodes
  for (const id of currentNodeIds) {
    if (!proposedNodeIds.has(id)) {
      const node = current.nodes[id];
      nodes.push({ id, status: 'removed', label: node.label, type: node.type });
    }
  }

  // Changed or unchanged nodes
  for (const id of currentNodeIds) {
    if (proposedNodeIds.has(id)) {
      const cur = current.nodes[id];
      const prop = proposed.nodes[id];
      const changed = cur.label !== prop.label || cur.type !== prop.type;
      nodes.push({
        id,
        status: changed ? 'changed' : 'unchanged',
        label: prop.label,
        type: prop.type,
      });
    }
  }

  const currentEdgeIds = new Set(Object.keys(current.edges));
  const proposedEdgeIds = new Set(Object.keys(proposed.edges));

  const edges: EdgeDiff[] = [];

  for (const id of proposedEdgeIds) {
    if (!currentEdgeIds.has(id)) {
      const edge = proposed.edges[id];
      edges.push({ id, status: 'added', label: `${edge.from} → ${edge.to}` });
    }
  }

  for (const id of currentEdgeIds) {
    if (!proposedEdgeIds.has(id)) {
      const edge = current.edges[id];
      edges.push({ id, status: 'removed', label: `${edge.from} → ${edge.to}` });
    }
  }

  for (const id of currentEdgeIds) {
    if (proposedEdgeIds.has(id)) {
      edges.push({
        id,
        status: 'unchanged',
        label: `${proposed.edges[id].from} → ${proposed.edges[id].to}`,
      });
    }
  }

  return { nodes, edges };
}

const STATUS_STYLES: Record<NodeDiff['status'], string> = {
  added:
    'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200',
  removed:
    'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200',
  changed:
    'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200',
  unchanged:
    'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
};

const STATUS_ICONS: Record<NodeDiff['status'], React.ReactNode> = {
  added: <Plus className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />,
  removed: <Minus className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />,
  changed: <Edit2 className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />,
  unchanged: null,
};

export function DiffPreview({ currentFlow, proposedFlow, onApply, onReject }: DiffPreviewProps) {
  const diff = useMemo(() => computeDiff(currentFlow, proposedFlow), [currentFlow, proposedFlow]);

  const addedNodes = diff.nodes.filter(n => n.status === 'added').length;
  const removedNodes = diff.nodes.filter(n => n.status === 'removed').length;
  const changedNodes = diff.nodes.filter(n => n.status === 'changed').length;
  const addedEdges = diff.edges.filter(e => e.status === 'added').length;
  const removedEdges = diff.edges.filter(e => e.status === 'removed').length;

  const hasChanges = addedNodes + removedNodes + changedNodes + addedEdges + removedEdges > 0;

  const visibleNodes = diff.nodes.filter(n => n.status !== 'unchanged');
  const visibleEdges = diff.edges.filter(e => e.status !== 'unchanged');

  return (
    <div className="flex flex-col h-full">
      {/* Summary */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          変更内容のプレビュー
        </h3>
        {hasChanges ? (
          <div className="flex flex-wrap gap-2 text-xs">
            {addedNodes > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                <Plus className="w-3 h-3" />
                ノード +{addedNodes}
              </span>
            )}
            {removedNodes > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                <Minus className="w-3 h-3" />
                ノード -{removedNodes}
              </span>
            )}
            {changedNodes > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                <Edit2 className="w-3 h-3" />
                変更 {changedNodes}
              </span>
            )}
            {addedEdges > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                <Plus className="w-3 h-3" />
                エッジ +{addedEdges}
              </span>
            )}
            {removedEdges > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                <Minus className="w-3 h-3" />
                エッジ -{removedEdges}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">変更なし</p>
        )}
      </div>

      {/* Diff detail */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {visibleNodes.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              ノード
            </h4>
            <div className="space-y-1.5">
              {visibleNodes.map(node => (
                <div
                  key={`${node.status}-${node.id}`}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs ${STATUS_STYLES[node.status]}`}
                >
                  {STATUS_ICONS[node.status]}
                  <span className="font-medium">{node.label}</span>
                  <span className="opacity-60">({node.type})</span>
                  <span className="ml-auto opacity-50 font-mono">{node.id}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {visibleEdges.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              エッジ
            </h4>
            <div className="space-y-1.5">
              {visibleEdges.map(edge => (
                <div
                  key={`${edge.status}-${edge.id}`}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs ${
                    edge.status === 'added'
                      ? STATUS_STYLES.added
                      : edge.status === 'removed'
                        ? STATUS_STYLES.removed
                        : STATUS_STYLES.unchanged
                  }`}
                >
                  {edge.status === 'added' ? (
                    <Plus className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  )}
                  <span className="font-mono">{edge.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasChanges && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            現在のフローと同一の内容です
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
        <button
          type="button"
          onClick={onApply}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <Check className="w-4 h-4" />
          適用
        </button>
        <button
          type="button"
          onClick={onReject}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
          却下
        </button>
      </div>
    </div>
  );
}
