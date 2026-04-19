'use client';

import React, { useState } from 'react';
import { X, LayoutGrid, Briefcase, CheckSquare, ClipboardList, Layers } from 'lucide-react';
import type { Flow } from '@/core/parser/schema';
import { FLOW_TEMPLATES, type FlowTemplate } from './templates';

interface TemplateGalleryProps {
  onSelectTemplate: (flow: Flow) => void;
  onClose: () => void;
}

type Category = 'all' | FlowTemplate['category'];

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'すべて',
  business: '業務プロセス',
  approval: '承認フロー',
  quality: '品質管理',
  general: '汎用',
};

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  all: <LayoutGrid className="w-4 h-4" />,
  business: <Briefcase className="w-4 h-4" />,
  approval: <CheckSquare className="w-4 h-4" />,
  quality: <ClipboardList className="w-4 h-4" />,
  general: <Layers className="w-4 h-4" />,
};

const NODE_TYPE_COLORS: Record<string, string> = {
  start: 'bg-green-500',
  end: 'bg-red-500',
  process: 'bg-blue-500',
  decision: 'bg-yellow-500',
  database: 'bg-purple-500',
  'llm-task': 'bg-pink-500',
  'human-review': 'bg-orange-500',
};

function MiniFlowPreview({ flow }: { flow: Flow }) {
  const nodes = Object.values(flow.nodes);
  const nodeCount = nodes.length;
  const edgeCount = Object.keys(flow.edges).length;

  // Show up to 6 nodes as colored dots
  const visibleNodes = nodes.slice(0, 6);

  return (
    <div className="h-20 bg-gray-50 dark:bg-gray-900 rounded-lg flex flex-col items-center justify-center gap-2 p-3">
      <div className="flex flex-wrap gap-1.5 justify-center">
        {visibleNodes.map(node => (
          <div
            key={node.id}
            title={node.label}
            className={`w-5 h-5 rounded-full flex-shrink-0 ${NODE_TYPE_COLORS[node.type] ?? 'bg-gray-400'}`}
          />
        ))}
        {nodeCount > 6 && (
          <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs text-gray-600 dark:text-gray-400">
            +{nodeCount - 6}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {nodeCount} ノード / {edgeCount} エッジ
      </p>
    </div>
  );
}

const LAYER_BADGE: Record<string, string> = {
  L0: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  L1: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  L2: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
};

export function TemplateGallery({ onSelectTemplate, onClose }: TemplateGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');

  const filtered =
    selectedCategory === 'all'
      ? FLOW_TEMPLATES
      : FLOW_TEMPLATES.filter(t => t.category === selectedCategory);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              テンプレートギャラリー
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category filter */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {CATEGORY_ICONS[cat]}
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  onSelectTemplate(template.flow);
                  onClose();
                }}
                className="
                  text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700
                  hover:border-blue-400 dark:hover:border-blue-500
                  hover:shadow-md
                  bg-white dark:bg-gray-800
                  transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                "
              >
                <MiniFlowPreview flow={template.flow} />
                <div className="mt-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                      {template.name}
                    </h3>
                    <span
                      className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                        LAYER_BADGE[template.flow.layer] ?? ''
                      }`}
                    >
                      {template.flow.layer}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {template.description}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-gray-400 dark:text-gray-500 py-12">
              このカテゴリのテンプレートはありません
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            テンプレートを選択すると、現在のキャンバスに適用されます。undo で元に戻せます。
          </p>
        </div>
      </div>
    </div>
  );
}
