/**
 * FlowOps - Flow Viewer Component
 *
 * フロー詳細表示画面
 * - 日本語ラベル
 * - コンテキストヘルプ
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MermaidViewer } from './MermaidViewer';
import { FlowExportImport } from './FlowExportImport';
import { Flow } from '@/core/parser';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { ArrowLeft, FileText, Layers, Eye, Code, AlertCircle, Upload } from 'lucide-react';
import { EditorToolbar } from './editor/EditorToolbar';
import { NodeEditPanel } from './editor/NodeEditPanel';
import { EdgeEditPanel } from './editor/EdgeEditPanel';
import { useFlowEditor } from './editor/useFlowEditor';
import type { FlowNode, FlowEdge } from './editor/types';

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
  onSave?: (yamlContent: string, flowId: string) => Promise<void>;
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
  onSave,
}: FlowViewerProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'diagram' | 'data' | 'export-import'>('diagram');
  const [editable, setEditable] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const editor = useFlowEditor(flow);

  const nodeCount = Object.keys(flow.nodes).length;
  const edgeCount = Object.keys(flow.edges).length;

  // Warn on page leave if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (editor.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editor.isDirty]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedNode(nodeId);
      setSelectedEdge(null);
      onNodeClick?.(nodeId);
    },
    [onNodeClick]
  );

  const handleEdgeClick = useCallback((edgeId: string) => {
    setSelectedEdge(edgeId);
    setSelectedNode(null);
  }, []);

  const handleToggleEditable = useCallback(() => {
    setEditable(prev => !prev);
    if (editable) {
      // Leaving edit mode: clear selections
      setSelectedNode(null);
      setSelectedEdge(null);
    }
    setSaveError(null);
    setValidationErrors([]);
  }, [editable]);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    const { stringifyFlow, validateFlow } = await import('@/core/parser');
    const updatedFlow = editor.toFlow({
      id: flow.id,
      title: flow.title,
      layer: flow.layer,
      updatedAt: new Date().toISOString(),
    });

    const { valid, errors } = validateFlow(updatedFlow);
    if (!valid) {
      setValidationErrors(errors.map(e => e.message));
      return;
    }

    setValidationErrors([]);
    setIsSaving(true);
    setSaveError(null);
    try {
      const yaml = stringifyFlow(updatedFlow);
      await onSave(yaml, flow.id);
      editor.resetDirty();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }, [onSave, editor, flow]);

  const selectedNodeData = selectedNode
    ? (editor.nodes.find((n: FlowNode) => n.id === selectedNode) ?? null)
    : null;

  const selectedEdgeData = selectedEdge
    ? (editor.edges.find((e: FlowEdge) => e.id === selectedEdge) ?? null)
    : null;

  // View-only selected node fallback (from original flow when not in edit mode)
  const viewSelectedNodeData = !editable && selectedNode ? flow.nodes[selectedNode] : null;

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

      {/* Editor Toolbar (diagram tab only) */}
      {activeTab === 'diagram' && (
        <EditorToolbar
          editable={editable}
          onToggleEditable={handleToggleEditable}
          onAddNode={editor.addNode}
          onSave={handleSave}
          onUndo={editor.undo}
          onRedo={editor.redo}
          onAutoLayout={editor.autoLayout}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
          isDirty={editor.isDirty}
          isSaving={isSaving}
        />
      )}

      {/* Validation / Save errors */}
      {(validationErrors.length > 0 || saveError) && (
        <div className="flex-shrink-0 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
          {validationErrors.map((msg, i) => (
            <p key={i} className="text-sm text-red-600 dark:text-red-400">
              {msg}
            </p>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Area */}
        <div className="flex-1 p-4 overflow-auto bg-gray-50 dark:bg-gray-900">
          {activeTab === 'diagram' ? (
            <div className="h-full flex flex-col">
              {!editable && !selectedNode && (
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-3 text-center">
                  ノードをクリックすると詳細が表示されます
                </p>
              )}
              <div className="flex-1 min-h-[400px]">
                <FlowCanvas
                  key={`${flow.id}-${editable ? 'edit' : 'view'}`}
                  flow={flow}
                  onNodeClick={handleNodeClick}
                  onEdgeClick={handleEdgeClick}
                  selectedNodeId={selectedNode}
                  className="h-full"
                  editable={editable}
                  nodes={editable ? editor.nodes : undefined}
                  edges={editable ? editor.edges : undefined}
                  onNodesChange={editable ? editor.onNodesChange : undefined}
                  onEdgesChange={editable ? editor.onEdgesChange : undefined}
                  onConnect={editable ? editor.onConnect : undefined}
                  onDeleteSelected={editable ? editor.deleteSelected : undefined}
                  onUndo={editable ? editor.undo : undefined}
                  onRedo={editable ? editor.redo : undefined}
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

        {/* Side Panel - Edit mode: NodeEditPanel or EdgeEditPanel */}
        {editable && activeTab === 'diagram' && selectedNodeData && (
          <NodeEditPanel
            node={selectedNodeData}
            onUpdateNode={editor.updateNode}
            onDeleteNode={id => {
              editor.deleteNode(id);
              setSelectedNode(null);
            }}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {editable && activeTab === 'diagram' && !selectedNodeData && selectedEdgeData && (
          <EdgeEditPanel
            edge={selectedEdgeData}
            onUpdateEdge={editor.updateEdge}
            onDeleteEdge={id => {
              editor.deleteEdge(id);
              setSelectedEdge(null);
            }}
            onClose={() => setSelectedEdge(null)}
          />
        )}

        {/* Side Panel - View mode: read-only node details */}
        {!editable && viewSelectedNodeData && (
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
                    {viewSelectedNodeData.id}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">タイプ</dt>
                  <dd className="capitalize text-gray-900 dark:text-gray-100">
                    {viewSelectedNodeData.type}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">ラベル</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{viewSelectedNodeData.label}</dd>
                </div>
                {viewSelectedNodeData.role && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">担当</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      {viewSelectedNodeData.role}
                    </dd>
                  </div>
                )}
                {viewSelectedNodeData.system && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">システム</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      {viewSelectedNodeData.system}
                    </dd>
                  </div>
                )}
                {viewSelectedNodeData.meta && Object.keys(viewSelectedNodeData.meta).length > 0 && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">メタデータ</dt>
                    <dd className="font-mono text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
                      {JSON.stringify(viewSelectedNodeData.meta, null, 2)}
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
