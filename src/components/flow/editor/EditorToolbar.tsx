'use client';

import React from 'react';
import {
  Play,
  Square,
  Cog,
  GitBranch,
  Database,
  Sparkles,
  UserCheck,
  Save,
  Undo2,
  Redo2,
  LayoutDashboard,
  Eye,
  Pencil,
  Grid3x3,
  LucideIcon,
} from 'lucide-react';
import { NODE_STYLE_MAP } from './node-styles';
import type { NodeType } from '@/core/parser/schema';

const NODE_ICONS: Record<NodeType, LucideIcon> = {
  start: Play,
  end: Square,
  process: Cog,
  decision: GitBranch,
  database: Database,
  'llm-task': Sparkles,
  'human-review': UserCheck,
};

const NODE_LABELS: Record<NodeType, string> = {
  start: '開始',
  end: '終了',
  process: '処理',
  decision: '判断',
  database: 'DB',
  'llm-task': 'LLM',
  'human-review': 'レビュー',
};

const NODE_TYPES: NodeType[] = [
  'start',
  'end',
  'process',
  'decision',
  'database',
  'llm-task',
  'human-review',
];

interface EditorToolbarProps {
  onAddNode: (type: NodeType) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  isSaving: boolean;
  editable: boolean;
  onToggleEditable: () => void;
  onOpenTemplates?: () => void;
  onToggleAIPanel?: () => void;
  isAIPanelOpen?: boolean;
}

export function EditorToolbar({
  onAddNode,
  onSave,
  onUndo,
  onRedo,
  onAutoLayout,
  canUndo,
  canRedo,
  isDirty,
  isSaving,
  editable,
  onToggleEditable,
  onOpenTemplates,
  onToggleAIPanel,
  isAIPanelOpen,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap">
      {/* 編集/閲覧モード切替 */}
      <button
        type="button"
        onClick={onToggleEditable}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
          ${
            editable
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }
        `}
        title={editable ? '閲覧モードに切替' : '編集モードに切替'}
      >
        {editable ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        {editable ? '編集中' : '閲覧'}
      </button>

      {/* Template Gallery button */}
      {onOpenTemplates && (
        <button
          type="button"
          onClick={onOpenTemplates}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          title="テンプレートギャラリー"
        >
          <Grid3x3 className="w-4 h-4" />
          テンプレート
        </button>
      )}

      {/* AI Assistant button */}
      {onToggleAIPanel && (
        <button
          type="button"
          onClick={onToggleAIPanel}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            isAIPanelOpen
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          title="AIアシスタント"
        >
          <Sparkles className="w-4 h-4" />
          AI
        </button>
      )}

      {editable && (
        <>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />

          {/* ノード追加ボタン群 */}
          <div className="flex items-center gap-1">
            {NODE_TYPES.map(type => {
              const style = NODE_STYLE_MAP[type];
              const Icon = NODE_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onAddNode(type)}
                  className={`
                    flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-opacity hover:opacity-80
                    ${style.bgColor} ${style.textColor}
                  `}
                  title={`${NODE_LABELS[type]}ノードを追加`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {NODE_LABELS[type]}
                </button>
              );
            })}
          </div>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />

          {/* Undo / Redo */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="元に戻す (Undo)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="やり直す (Redo)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          {/* 自動レイアウト */}
          <button
            type="button"
            onClick={onAutoLayout}
            className="p-1.5 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="自動レイアウト (dagre)"
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />

          {/* 保存ボタン */}
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              ${
                isDirty && !isSaving
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }
            `}
            title="保存"
          >
            <Save className="w-4 h-4" />
            {isSaving ? '保存中...' : '保存'}
          </button>
        </>
      )}
    </div>
  );
}

export default EditorToolbar;
