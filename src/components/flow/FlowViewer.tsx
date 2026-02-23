/**
 * FlowOps - Flow Viewer Component
 *
 * フロー詳細表示画面
 * - 日本語ラベル
 * - コンテキストヘルプ
 */

'use client';

import React, { useState } from 'react';
import { MermaidViewer } from './MermaidViewer';
import { Flow } from '@/core/parser';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { ArrowLeft, FileText, Layers, Eye, Code, AlertCircle } from 'lucide-react';

interface FlowViewerProps {
  flow: Flow;
  mermaidContent: string;
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
  onBack,
  onNodeClick,
  onCreateIssue,
}: FlowViewerProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'diagram' | 'data'>('diagram');

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
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            フロー一覧に戻る
          </button>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{flow.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
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
        <div className="mt-4 flex gap-4 border-b border-gray-200 -mb-px">
          <button
            type="button"
            onClick={() => setActiveTab('diagram')}
            className={`
              px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${
                activeTab === 'diagram'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <Code className="w-4 h-4 inline mr-1" />
            生データ
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Area */}
        <div className="flex-1 p-4 overflow-auto bg-gray-50">
          {activeTab === 'diagram' ? (
            <div>
              {!selectedNode && (
                <p className="text-sm text-gray-400 mb-3 text-center">
                  ノードをクリックすると詳細が表示されます
                </p>
              )}
              <MermaidViewer
                content={mermaidContent}
                onNodeClick={handleNodeClick}
                className="h-full"
              />
            </div>
          ) : (
            <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-sm overflow-x-auto">
              {JSON.stringify(flow, null, 2)}
            </pre>
          )}
        </div>

        {/* Side Panel - Selected Node */}
        {selectedNodeData && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">ノード詳細</h3>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  x
                </button>
              </div>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">ID</dt>
                  <dd className="font-mono text-gray-900">{selectedNodeData.id}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">タイプ</dt>
                  <dd className="capitalize text-gray-900">{selectedNodeData.type}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">ラベル</dt>
                  <dd className="text-gray-900">{selectedNodeData.label}</dd>
                </div>
                {selectedNodeData.role && (
                  <div>
                    <dt className="text-gray-500">担当</dt>
                    <dd className="text-gray-900">{selectedNodeData.role}</dd>
                  </div>
                )}
                {selectedNodeData.system && (
                  <div>
                    <dt className="text-gray-500">システム</dt>
                    <dd className="text-gray-900">{selectedNodeData.system}</dd>
                  </div>
                )}
                {selectedNodeData.meta && Object.keys(selectedNodeData.meta).length > 0 && (
                  <div>
                    <dt className="text-gray-500">メタデータ</dt>
                    <dd className="font-mono text-xs bg-gray-50 p-2 rounded">
                      {JSON.stringify(selectedNodeData.meta, null, 2)}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Connected Edges */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-2">接続先</h4>
                <ul className="space-y-2 text-sm">
                  {Object.values(flow.edges)
                    .filter(e => e.from === selectedNode || e.to === selectedNode)
                    .map(edge => (
                      <li key={edge.id} className="flex items-center gap-2 text-gray-600">
                        <span className="font-mono text-xs">
                          {edge.from} → {edge.to}
                        </span>
                        {edge.label && <span className="text-gray-400">({edge.label})</span>}
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
