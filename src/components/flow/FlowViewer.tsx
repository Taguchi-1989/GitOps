/**
 * FlowOps - Flow Viewer Component
 *
 * フロー詳細表示画面
 * - 日本語ラベル
 * - コンテキストヘルプ
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FlowExportImport } from './FlowExportImport';
import { FlowGridEditor } from './grid/FlowGridEditor';
import { Flow, stringifyFlow } from '@/core/parser';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useDisplayMode } from '@/lib/simple-mode-context';
import { EDGE_TERM, getNodeTerm } from '@/lib/ui-labels';
import {
  ArrowLeft,
  FileText,
  Layers,
  Eye,
  Code,
  AlertCircle,
  Upload,
  Table2,
  Save,
  Pencil,
  Wrench,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { NODE_TYPE_LABELS } from './editor/node-styles';
import { EditorToolbar } from './editor/EditorToolbar';
import { NodeEditPanel } from './editor/NodeEditPanel';
import { EdgeEditPanel } from './editor/EdgeEditPanel';
import { useFlowEditor } from './editor/useFlowEditor';
import { AIChatPanel } from './editor/AIChatPanel';
import { TemplateGallery } from './editor/TemplateGallery';
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
  baseHash?: string;
  onBack?: () => void;
  onNodeClick?: (nodeId: string) => void;
  onCreateIssue?: (nodeId?: string) => void;
  /** 編集内容を「改善案(Proposal)」として申請する。即時上書きはしない。 */
  onSave?: (updatedFlow: Flow, options?: { intent?: string }) => Promise<void>;
}

const layerLabels: Record<string, string> = {
  L0: 'L0 - 戦略レイヤー',
  L1: 'L1 - 業務プロセス',
  L2: 'L2 - システム手順',
};

type TabId = 'diagram' | 'data' | 'grid' | 'export-import';

/** 「詳細ツール」メニューに格納するタブ(初期表示のボタン数を抑える) */
interface DetailTool {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

/** 未保存の変更があるときに確認をはさむ保留中の操作 */
type PendingAction =
  | { kind: 'back' }
  | { kind: 'exit-edit' }
  | { kind: 'create-issue'; nodeId?: string }
  | { kind: 'switch-tab'; tab: TabId };

const PENDING_ACTION_TEXT: Record<
  PendingAction['kind'],
  {
    description: string;
    whatHappens: string[];
    confirmLabel: string;
    confirmColor: 'blue' | 'red';
  }
> = {
  back: {
    description: '保存せずにフロー一覧に戻りますか？',
    whatHappens: ['この画面での編集内容は保存されません', 'キャンセルすると編集を続けられます'],
    confirmLabel: '保存せずに戻る',
    confirmColor: 'red',
  },
  'exit-edit': {
    description: '保存せずに閲覧モードに戻りますか？',
    whatHappens: [
      '編集内容はこの画面に保持されます（破棄されません）',
      '編集モードに戻せば保存ボタンから保存できます',
    ],
    confirmLabel: '閲覧モードに戻る',
    confirmColor: 'blue',
  },
  'create-issue': {
    description: '保存せずに困りごとの報告画面へ移動しますか？',
    whatHappens: [
      'この画面での編集内容は保存されません',
      'キャンセルすると編集を続けられます（先に保存できます）',
    ],
    confirmLabel: '保存せずに移動する',
    confirmColor: 'red',
  },
  'switch-tab': {
    description: '表の未保存の変更が失われます。切り替えますか？',
    whatHappens: [
      '表（グリッド）で編集した内容は破棄されます',
      'キャンセルすると表に戻って「保存して反映を申請」できます',
    ],
    confirmLabel: '破棄して切り替える',
    confirmColor: 'red',
  },
};

export function FlowViewer({
  flow,
  mermaidContent,
  yamlContent,
  baseHash,
  onBack,
  onNodeClick,
  onCreateIssue,
  onSave,
}: FlowViewerProps) {
  const { isTechMode } = useDisplayMode();
  /** 表示モードに応じた「ノード」/「ステップ」の呼び方 */
  const nodeTerm = getNodeTerm(isTechMode);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabId>('diagram');
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [editable, setEditable] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false);
  // 未保存の変更があるときに確認が必要な保留中の操作
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  // グリッド(表)編集の未保存状態。タブ切替でアンマウントされ内容が失われるため親で保持する
  const [gridDirty, setGridDirty] = useState(false);
  // テンプレート適用は現在の図を全置換するため確認する
  const [pendingTemplate, setPendingTemplate] = useState<Flow | null>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const editor = useFlowEditor(flow);
  const currentFlow = useMemo(
    () =>
      editor.toFlow({
        id: flow.id,
        title: flow.title,
        layer: flow.layer,
        updatedAt: flow.updatedAt,
      }),
    // editor.toFlow is stable (useCallback on [nodes, edges]); using it instead of
    // the editor object literal prevents currentFlow from recomputing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor.toFlow, flow.id, flow.title, flow.layer, flow.updatedAt]
  );
  const displayedFlow = currentFlow;
  const displayedYaml = useMemo(
    () =>
      editor.isDirty || editable
        ? stringifyFlow(currentFlow)
        : (yamlContent ?? stringifyFlow(flow)),
    [editor.isDirty, editable, currentFlow, yamlContent, flow]
  );

  const nodeCount = Object.keys(displayedFlow.nodes).length;
  const edgeCount = Object.keys(displayedFlow.edges).length;

  // 「詳細ツール」メニューの中身(機能は削らず、初期表示から畳むだけ)
  const detailTools = useMemo<DetailTool[]>(() => {
    const tools: DetailTool[] = [];
    if (baseHash) tools.push({ id: 'grid', label: '表で編集（グリッド）', icon: Table2 });
    if (yamlContent)
      tools.push({ id: 'export-import', label: '入出力（エクスポート/インポート）', icon: Upload });
    if (isTechMode) tools.push({ id: 'data', label: '生データ', icon: Code });
    return tools;
  }, [baseHash, yamlContent, isTechMode]);

  // 詳細モードを切ると「生データ」タブが消えるため、ダイアグラム表示に戻す
  const activeTab: TabId = selectedTab === 'data' && !isTechMode ? 'diagram' : selectedTab;
  const activeDetailTool = detailTools.find(t => t.id === activeTab) ?? null;

  // 詳細ツールメニューの外側クリックで閉じる
  useEffect(() => {
    if (!isToolsMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!toolsMenuRef.current?.contains(e.target as Node)) setIsToolsMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isToolsMenuOpen]);

  /** 図・表いずれかに未保存の変更があるか */
  const hasUnsavedChanges = editor.isDirty || gridDirty;

  // Warn on page leave if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

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

  const applyToggleEditable = useCallback(() => {
    setEditable(prev => !prev);
    if (editable) {
      // Leaving edit mode: clear selections
      setSelectedNode(null);
      setSelectedEdge(null);
    }
    setSaveError(null);
    setValidationErrors([]);
  }, [editable]);

  const handleToggleEditable = useCallback(() => {
    // 編集モードOFFに戻すとき、未保存の変更があれば確認する
    if (editable && editor.isDirty) {
      setPendingAction({ kind: 'exit-edit' });
      return;
    }
    applyToggleEditable();
  }, [editable, editor.isDirty, applyToggleEditable]);

  const handleBack = useCallback(() => {
    if (!onBack) return;
    // クライアント遷移では beforeunload が発火しないため、ここで確認する
    if (hasUnsavedChanges) {
      setPendingAction({ kind: 'back' });
      return;
    }
    onBack();
  }, [onBack, hasUnsavedChanges]);

  const handleCreateIssue = useCallback(
    (nodeId?: string) => {
      if (!onCreateIssue) return;
      // 別画面への遷移なので、戻るボタンと同じく未保存の変更を確認する
      if (hasUnsavedChanges) {
        setPendingAction({ kind: 'create-issue', nodeId });
        return;
      }
      onCreateIssue(nodeId);
    },
    [onCreateIssue, hasUnsavedChanges]
  );

  /**
   * タブ切替。表(グリッド)はアンマウントで編集内容が失われるため、
   * 未保存のまま離れるときだけ確認する(図の編集内容はタブを移っても保持される)。
   */
  const requestTabChange = useCallback(
    (tab: TabId) => {
      if (tab === activeTab) return;
      if (activeTab === 'grid' && gridDirty) {
        setPendingAction({ kind: 'switch-tab', tab });
        return;
      }
      setSelectedTab(tab);
    },
    [activeTab, gridDirty]
  );

  const handleConfirmPendingAction = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    if (action.kind === 'back') {
      onBack?.();
    } else if (action.kind === 'exit-edit') {
      applyToggleEditable();
    } else if (action.kind === 'create-issue') {
      onCreateIssue?.(action.nodeId);
    } else if (action.kind === 'switch-tab') {
      // グリッドはアンマウントされ編集内容が破棄されるので dirty も落とす
      setGridDirty(false);
      setSelectedTab(action.tab);
    }
  }, [pendingAction, onBack, onCreateIssue, applyToggleEditable]);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    const { validateFlow } = await import('@/core/parser');
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
      await onSave(updatedFlow);
      editor.resetDirty();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '申請に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }, [onSave, editor, flow]);

  const handleApplyFlow = useCallback(
    (generatedFlow: Flow) => {
      editor.loadFlow(generatedFlow);
    },
    [editor]
  );

  const applyTemplate = useCallback(
    (templateFlow: Flow) => {
      editor.loadFlow({
        ...templateFlow,
        updatedAt: new Date().toISOString(),
      });
    },
    [editor]
  );

  const handleSelectTemplate = useCallback(
    (templateFlow: Flow) => {
      // テンプレートは現在の図を全置換するため、中身があるときは確認する
      if (editor.nodes.length > 0 || editor.edges.length > 0) {
        setPendingTemplate(templateFlow);
        return;
      }
      applyTemplate(templateFlow);
    },
    [editor.nodes.length, editor.edges.length, applyTemplate]
  );

  const selectedNodeData = selectedNode
    ? (editor.nodes.find((n: FlowNode) => n.id === selectedNode) ?? null)
    : null;

  const selectedEdgeData = selectedEdge
    ? (editor.edges.find((e: FlowEdge) => e.id === selectedEdge) ?? null)
    : null;

  const viewSelectedNodeData = !editable && selectedNode ? displayedFlow.nodes[selectedNode] : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {onBack && (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            フロー一覧に戻る
          </button>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{flow.title}</h1>
              {editor.isDirty && (
                <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                  未保存
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
              {isTechMode && (
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  {flow.id}.yaml
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                {layerLabels[flow.layer] || flow.layer}
                <HelpTooltip content="L0=経営戦略、L1=業務プロセス、L2=システム手順の3階層でフローを管理します" />
              </span>
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                {isTechMode
                  ? `${nodeCount} ${nodeTerm} / ${edgeCount} ${EDGE_TERM.standard}`
                  : `${nodeCount} ${nodeTerm}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 初期状態の主ボタン(1): 編集へ入る */}
            {activeTab === 'diagram' && !editable && (
              <button
                type="button"
                onClick={handleToggleEditable}
                className="
                  flex items-center gap-2 px-4 py-2
                  bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100
                  rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
                "
              >
                <Pencil className="w-4 h-4" />
                この図を編集
              </button>
            )}

            {/* 初期状態の主ボタン(2): 困りごとの報告(Issue作成) */}
            {onCreateIssue && (
              <button
                type="button"
                onClick={() => handleCreateIssue(selectedNode || undefined)}
                className="
                  flex items-center gap-2 px-4 py-2
                  bg-blue-600 text-white rounded-lg
                  hover:bg-blue-700 transition-colors
                "
              >
                <AlertCircle className="w-4 h-4" />
                <span>
                  困りごとを報告
                  {selectedNode && (
                    <span className="text-blue-200 text-xs block">{selectedNode} に対して</span>
                  )}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-4 border-b border-gray-200 dark:border-gray-700 -mb-px">
          <button
            type="button"
            onClick={() => requestTabChange('diagram')}
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
          {/* 詳細ツール: グリッド / 入出力 / (詳細モードのみ)生データ をメニューに格納 */}
          {detailTools.length > 0 && (
            <div className="relative" ref={toolsMenuRef}>
              <button
                type="button"
                onClick={() => setIsToolsMenuOpen(prev => !prev)}
                aria-haspopup="menu"
                aria-expanded={isToolsMenuOpen}
                className={`
                  px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
                  ${
                    activeDetailTool
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                <Wrench className="w-4 h-4 inline mr-1" />
                {activeDetailTool ? `詳細ツール: ${activeDetailTool.label}` : '詳細ツール'}
                <ChevronDown className="w-4 h-4 inline ml-1" />
              </button>

              {isToolsMenuOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
                >
                  {detailTools.map(tool => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          requestTabChange(tool.id);
                          setIsToolsMenuOpen(false);
                        }}
                        className={`
                          w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                          hover:bg-gray-100 dark:hover:bg-gray-700
                          ${activeTab === tool.id ? 'text-blue-600 font-medium' : 'text-gray-700 dark:text-gray-200'}
                        `}
                      >
                        <Icon className="w-4 h-4" />
                        {tool.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Editor Toolbar (編集モードのダイアグラムタブのみ。閲覧時はヘッダの「この図を編集」から入る) */}
      {activeTab === 'diagram' && editable && (
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
          onOpenTemplates={() => setIsTemplateGalleryOpen(true)}
          onToggleAIPanel={() => setIsAIPanelOpen(prev => !prev)}
          isAIPanelOpen={isAIPanelOpen}
        />
      )}

      {/* Unsaved changes banner (EditorToolbar はダイアグラムタブにしか出ないため、
          他タブでも保存に到達できる導線を常時表示する) */}
      {editor.isDirty && !(activeTab === 'diagram' && editable) && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
            未保存の変更があります
          </p>
          {onSave && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? '申請中...' : '保存して反映を申請'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'diagram') {
                requestTabChange('diagram');
              } else {
                applyToggleEditable();
              }
            }}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-white dark:bg-gray-800 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          >
            {activeTab !== 'diagram' ? 'ダイアグラムに戻る' : '編集モードに戻る'}
          </button>
        </div>
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
                  {nodeTerm}をクリックすると詳細が表示されます
                </p>
              )}
              <div className="flex-1 min-h-[400px]">
                <FlowCanvas
                  key={`${flow.id}-${editable ? 'edit' : 'view'}`}
                  flow={displayedFlow}
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
              {JSON.stringify(displayedFlow, null, 2)}
            </pre>
          ) : activeTab === 'grid' ? (
            baseHash ? (
              <FlowGridEditor
                flow={displayedFlow}
                baseHash={baseHash}
                onDirtyChange={setGridDirty}
              />
            ) : null
          ) : displayedYaml ? (
            <FlowExportImport
              flow={displayedFlow}
              yamlContent={displayedYaml}
              mermaidContent={mermaidContent}
              onImportProposal={onSave}
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

        {/* AI Chat Panel */}
        {isAIPanelOpen && activeTab === 'diagram' && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 overflow-hidden">
            <AIChatPanel
              currentFlow={displayedFlow}
              onApplyFlow={handleApplyFlow}
              className="h-full"
            />
          </div>
        )}

        {/* Side Panel - View mode: read-only node details */}
        {!editable && viewSelectedNodeData && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{nodeTerm}詳細</h3>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                  aria-label={`${nodeTerm}詳細パネルを閉じる`}
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
                  <dt className="text-gray-500 dark:text-gray-400">種類</dt>
                  <dd className="text-gray-900 dark:text-gray-100">
                    {NODE_TYPE_LABELS[viewSelectedNodeData.type] ?? viewSelectedNodeData.type}
                    {isTechMode && (
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                        ({viewSelectedNodeData.type})
                      </span>
                    )}
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
                {isTechMode &&
                  viewSelectedNodeData.meta &&
                  Object.keys(viewSelectedNodeData.meta).length > 0 && (
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
                  {Object.values(displayedFlow.edges)
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
                  onClick={() => handleCreateIssue(selectedNode ?? undefined)}
                  className="
                    mt-6 w-full flex items-center justify-center gap-2
                    px-4 py-2 bg-blue-600 text-white rounded-lg
                    hover:bg-blue-700 transition-colors
                  "
                >
                  <AlertCircle className="w-4 h-4" />
                  このステップの困りごとを報告
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 未保存の変更がある状態での離脱・モード切替の確認 */}
      <ConfirmDialog
        isOpen={pendingAction !== null}
        onConfirm={handleConfirmPendingAction}
        onCancel={() => setPendingAction(null)}
        title="未保存の変更があります"
        description={PENDING_ACTION_TEXT[pendingAction?.kind ?? 'back'].description}
        whatHappens={PENDING_ACTION_TEXT[pendingAction?.kind ?? 'back'].whatHappens}
        confirmLabel={PENDING_ACTION_TEXT[pendingAction?.kind ?? 'back'].confirmLabel}
        confirmColor={PENDING_ACTION_TEXT[pendingAction?.kind ?? 'back'].confirmColor}
      />

      {/* テンプレート適用は現在の図を全置換するため確認する */}
      <ConfirmDialog
        isOpen={pendingTemplate !== null}
        onConfirm={() => {
          const template = pendingTemplate;
          setPendingTemplate(null);
          if (template) applyTemplate(template);
        }}
        onCancel={() => setPendingTemplate(null)}
        title="今の図をテンプレートで置き換えますか？"
        description={`「${pendingTemplate?.title ?? ''}」の内容で、この図のステップとつながりをすべて置き換えます。`}
        whatHappens={[
          '今表示されているステップ・つながりはすべて消えます',
          'まだ申請していないので、元に戻す（Undo）で戻せます',
          '「保存して反映を申請」を押すまで、正式なフローは変わりません',
        ]}
        confirmLabel="置き換える"
        confirmColor="red"
      />

      {/* Template Gallery Modal */}
      {isTemplateGalleryOpen && (
        <TemplateGallery
          onSelectTemplate={handleSelectTemplate}
          onClose={() => setIsTemplateGalleryOpen(false)}
        />
      )}
    </div>
  );
}
