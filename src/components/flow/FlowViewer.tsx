/**
 * FlowOps - Flow Viewer Component
 *
 * フロー詳細表示画面
 * - 日本語ラベル
 * - コンテキストヘルプ
 */

'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { MermaidViewer } from './MermaidViewer';
import { FlowExportImport } from './FlowExportImport';
import { Flow } from '@/core/parser';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { ArrowLeft, FileText, Layers, Eye, Code, AlertCircle, Upload } from 'lucide-react';

const FlowCanvas = dynamic(() => import('./editor/FlowCanvas').then(m => m.FlowCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
      ダイアグラムを読み込み中...
    </div>
  ),
});

interface FlowViewerProps {
  flow: Flow;
  mermaidContent: string;
  yamlContent?: string;
  onBack?: () => void;
  onNodeClick?: (nodeId: string) => void;
  onCreateIssue?: (nodeId?: string) => void;
}

const layerLabels: Record<string, string> = {
  L0: 'L0 - 戦略レイヤー',
  L1: 'L1 - 業務プロセス',
  L2: 'L2 - システム手順',
};

export function FlowViewer({
  flow,
  mermaidContent,
  yamlContent,
  onBack,
  onNodeClick,
  onCreateIssue,
}: FlowViewerProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'diagram' | 'data' | 'export-import'>('diagram');

  const nodeCount = Object.keys(flow.nodes).length;
  const edgeCount = Object.keys(flow.edges).length;

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
    onNodeClick?.(nodeId);
  };

  const selectedNodeData = selectedNode ? flow.nodes[selectedNode] : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            フロー一覧に戻る
          </button>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{flow.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                {flow.id}.yaml
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                {layerLabels[flow.layer] || flow.layer}
                <HelpTooltip content="L0=経営戦略、L1=業務プロセス、L2=システム手順の3階層でフローを管理します" />
              </span>
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                {nodeCount} ノード / {edgeCount} エッジ
              </span>
            </div>
          </div>

          {onCreateIssue && (
            <button
              type="button"
              onClick={() => onCreateIssue(selectedNode || undefined)}
              className="
                flex items-center gap-2 px-4 py-2
                bg-blue-600 text-white rounded-lg
                hover:bg-blue-700 transition-colors
              "
            >
              <AlertCircle className="w-4 h-4" />
              <span>
                Issueを作成
                {selectedNode && (
                  <span className="text-blue-200 text-xs block">{selectedNode} に対して</span>
                )}
              </span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-4 border-b border-gray-200 dark:border-gray-700 -mb-px">
          <button
            type="button"
            onClick={() => setActiveTab('diagram')}
            className={`
              px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${
                activeTab === 'diagram'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
          >
            <Eye className="w-4 h-4 inline mr-1" />
            ダイアグラム
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`
              px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${
                activeTab === 'data'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
          >
            <Code className="w-4 h-4 inline mr-1" />
            生データ
          </button>
          {yamlContent && (
            <button
              type="button"
              onClick={() => setActiveTab('export-import')}
              className={`
                px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
                ${
                  activeTab === 'export-import'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }
              `}
            >
              <Upload className="w-4 h-4 inline mr-1" />
              エクスポート
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Area */}
        <div className="flex-1 p-4 overflow-auto bg-gray-50 dark:bg-gray-900">
          {activeTab === 'diagram' ? (
            <div className="h-full flex flex-col">
              {!selectedNode && (
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-3 text-center">
                  ノードをクリックすると詳細が表示されます
                </p>
              )}
              <div className="flex-1 min-h-[400px]">
                <FlowCanvas
                  flow={flow}
                  onNodeClick={handleNodeClick}
                  selectedNodeId={selectedNode}
                  className="h-full"
                />
              </div>
            </div>
          ) : activeTab === 'data' ? (
            <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-sm overflow-x-auto">
              {JSON.stringify(flow, null, 2)}
            </pre>
          ) : yamlContent ? (
            <FlowExportImport
              flow={flow}
              yamlContent={yamlContent}
              onImportSuccess={() => window.location.reload()}
            />
          ) : null}
        </div>

        {/* Side Panel - Selected Node */}
        {selectedNodeData && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">ノード詳細</h3>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                  aria-label="ノード詳細パネルを閉じる"
                >
                  ✕
                </button>
              </div>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">ID</dt>
                  <dd className="font-mono text-gray-900 dark:text-gray-100">
                    {selectedNodeData.id}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">タイプ</dt>
                  <dd className="capitalize text-gray-900 dark:text-gray-100">
                    {selectedNodeData.type}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">ラベル</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{selectedNodeData.label}</dd>
                </div>
                {selectedNodeData.role && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">担当</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{selectedNodeData.role}</dd>
                  </div>
                )}
                {selectedNodeData.system && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">システム</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{selectedNodeData.system}</dd>
                  </div>
                )}
                {selectedNodeData.meta && Object.keys(selectedNodeData.meta).length > 0 && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">メタデータ</dt>
                    <dd className="font-mono text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
                      {JSON.stringify(selectedNodeData.meta, null, 2)}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Connected Edges */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">接続先</h4>
                <ul className="space-y-2 text-sm">
                  {Object.values(flow.edges)
                    .filter(e => e.from === selectedNode || e.to === selectedNode)
                    .map(edge => (
                      <li
                        key={edge.id}
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-400"
                      >
                        <span className="font-mono text-xs">
                          {edge.from} → {edge.to}
                        </span>
                        {edge.label && (
                          <span className="text-gray-400 dark:text-gray-500">({edge.label})</span>
                        )}
                      </li>
                    ))}
                </ul>
              </div>

              {/* Create Issue Button */}
              {onCreateIssue && (
                <button
                  type="button"
                  onClick={() => onCreateIssue(selectedNode ?? undefined)}
                  className="
                    mt-6 w-full flex items-center justify-center gap-2
                    px-4 py-2 bg-blue-600 text-white rounded-lg
                    hover:bg-blue-700 transition-colors
                  "
                >
                  <AlertCircle className="w-4 h-4" />
                  このノードのIssueを作成
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
