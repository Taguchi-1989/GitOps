'use client';

import React from 'react';
import { Trash2, X } from 'lucide-react';
import type { FlowNode, FlowNodeData } from './types';
import type { NodeType } from '@/core/parser/schema';

const NODE_TYPE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: 'start', label: '開始 (start)' },
  { value: 'end', label: '終了 (end)' },
  { value: 'process', label: '処理 (process)' },
  { value: 'decision', label: '判断 (decision)' },
  { value: 'database', label: 'データベース (database)' },
  { value: 'llm-task', label: 'LLMタスク (llm-task)' },
  { value: 'human-review', label: 'ヒューマンレビュー (human-review)' },
];

interface NodeEditPanelProps {
  node: FlowNode | null;
  onUpdateNode: (nodeId: string, data: Partial<FlowNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose?: () => void;
  roles?: string[];
  systems?: string[];
}

export function NodeEditPanel({
  node,
  onUpdateNode,
  onDeleteNode,
  onClose,
  roles,
  systems,
}: NodeEditPanelProps) {
  if (!node) return null;

  const { data } = node;

  const handleChange = (key: keyof FlowNodeData, value: string) => {
    onUpdateNode(node.id, { [key]: value });
  };

  return (
    <div className="w-72 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">ノード編集</h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              aria-label="パネルを閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 font-mono">{node.id}</p>

        <div className="space-y-4">
          {/* ラベル */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              ラベル
            </label>
            <input
              type="text"
              value={data.label}
              onChange={e => handleChange('label', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ノードラベル"
            />
          </div>

          {/* タイプ */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              タイプ
            </label>
            <select
              value={data.nodeType}
              onChange={e => handleChange('nodeType', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {NODE_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 担当 (role) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              担当 (role)
            </label>
            {roles && roles.length > 0 ? (
              <select
                value={data.role ?? ''}
                onChange={e => handleChange('role', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">なし</option>
                {roles.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={data.role ?? ''}
                onChange={e => handleChange('role', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="担当者・ロール"
              />
            )}
          </div>

          {/* システム (system) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              システム (system)
            </label>
            {systems && systems.length > 0 ? (
              <select
                value={data.system ?? ''}
                onChange={e => handleChange('system', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">なし</option>
                {systems.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={data.system ?? ''}
                onChange={e => handleChange('system', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="連携システム"
              />
            )}
          </div>

          {/* タスクID (taskId) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              タスクID (taskId)
            </label>
            <input
              type="text"
              value={data.taskId ?? ''}
              onChange={e => handleChange('taskId', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="spec/tasks/*.yaml の ID"
            />
          </div>
        </div>

        {/* 削除ボタン */}
        <button
          type="button"
          onClick={() => onDeleteNode(node.id)}
          className="mt-6 w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          ノードを削除
        </button>
      </div>
    </div>
  );
}

export default NodeEditPanel;
