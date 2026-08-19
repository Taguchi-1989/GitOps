'use client';

import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { FlowEdge } from './types';

interface EdgeEditPanelProps {
  edge: FlowEdge | null;
  onUpdateEdge: (edgeId: string, data: { label?: string; condition?: string }) => void;
  onDeleteEdge: (edgeId: string) => void;
  onClose?: () => void;
}

export function EdgeEditPanel({ edge, onUpdateEdge, onDeleteEdge, onClose }: EdgeEditPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!edge) return null;

  const currentLabel = typeof edge.label === 'string' ? edge.label : '';
  const currentCondition = edge.data?.condition ?? '';

  const handleLabelChange = (value: string) => {
    onUpdateEdge(edge.id, { label: value, condition: currentCondition });
  };

  const handleConditionChange = (value: string) => {
    onUpdateEdge(edge.id, { label: currentLabel, condition: value });
  };

  return (
    <div className="w-72 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">エッジ編集</h3>
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

        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 font-mono">{edge.id}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {edge.source} → {edge.target}
        </p>

        <div className="space-y-4">
          {/* ラベル */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              ラベル
            </label>
            <input
              type="text"
              value={currentLabel}
              onChange={e => handleLabelChange(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="エッジラベル（例: はい / いいえ）"
            />
          </div>

          {/* 条件 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              条件 (condition)
            </label>
            <input
              type="text"
              value={currentCondition}
              onChange={e => handleConditionChange(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="分岐条件（例: approved == true）"
            />
          </div>
        </div>

        {/* 削除ボタン */}
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="mt-6 w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          エッジを削除
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onConfirm={() => {
          setConfirmDelete(false);
          onDeleteEdge(edge.id);
        }}
        onCancel={() => setConfirmDelete(false)}
        title="このつながりを削除しますか？"
        description={`${edge.source} → ${edge.target} の線をこの図から削除します。`}
        whatHappens={[
          'ステップ自体は残り、つながり（線）だけが消えます',
          'まだ申請していないので、元に戻す（Undo）で戻せます',
        ]}
        confirmLabel="削除する"
        confirmColor="red"
      />
    </div>
  );
}

export default EdgeEditPanel;
