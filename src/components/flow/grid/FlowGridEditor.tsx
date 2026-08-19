/**
 * FlowOps - Flow Grid Editor
 *
 * フローの nodes/edges を表計算グリッドで編集する第2のUI。
 * 正本は YAML/Git のまま。保存時はサーバで JSON Patch 化し、既存の
 * Proposal→apply パイプラインに合流する(直接 YAML を書き換えない)。
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Download, Upload, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useDisplayMode } from '@/lib/simple-mode-context';
import type { Flow } from '@/core/parser';
import { NodeTypeSchema, DataLayerSchema } from '@/core/parser/schema';
import {
  flowToNodeRows,
  flowToEdgeRows,
  validateRows,
  hasBlockingErrors,
  emptyNodeRow,
  emptyEdgeRow,
  nodeRowsToCsv,
  edgeRowsToCsv,
  parseNodeCsv,
  parseEdgeCsv,
  type NodeRow,
  type EdgeRow,
  type CellError,
} from '@/core/grid';
import { EditableGrid, type GridColumn } from './EditableGrid';

const NODE_COLUMNS: GridColumn<NodeRow>[] = [
  { key: 'id', label: 'ID', kind: 'text' },
  { key: 'type', label: 'タイプ', kind: 'select', options: NodeTypeSchema.options },
  { key: 'label', label: 'ラベル', kind: 'text' },
  { key: 'role', label: '担当(role)', kind: 'text' },
  { key: 'system', label: 'システム', kind: 'text' },
  { key: 'taskId', label: 'タスクID', kind: 'text' },
  { key: 'description', label: '説明', kind: 'text' },
];

const EDGE_COLUMNS: GridColumn<EdgeRow>[] = [
  { key: 'id', label: 'ID', kind: 'text' },
  { key: 'from', label: 'from(始点)', kind: 'text' },
  { key: 'to', label: 'to(終点)', kind: 'text' },
  { key: 'label', label: 'ラベル', kind: 'text' },
  { key: 'condition', label: '条件', kind: 'text' },
  {
    key: 'dataLayer',
    label: 'データ層',
    kind: 'select',
    options: ['', ...DataLayerSchema.options],
  },
];

interface FlowGridEditorProps {
  flow: Flow;
  baseHash: string;
  /**
   * 未保存状態の変化を親に伝える。タブ切替でこのコンポーネントは
   * アンマウントされ編集内容が失われるため、親側で離脱ガードに使う。
   */
  onDirtyChange?: (dirty: boolean) => void;
}

type SubTab = 'nodes' | 'edges';

export function FlowGridEditor({ flow, baseHash, onDirtyChange }: FlowGridEditorProps) {
  const { addToast } = useToast();
  const { isTechMode } = useDisplayMode();
  const [subTab, setSubTab] = useState<SubTab>('nodes');
  /** 参照エッジがあるノード削除の確認（確認後に実行する削除内容を保持） */
  const [pendingNodeDelete, setPendingNodeDelete] = useState<{ edgeIds: string[] } | null>(null);
  /** 作成済み改善案を今すぐ適用するかの確認 */
  const [pendingApplyId, setPendingApplyId] = useState<string | null>(null);
  const [nodeRows, setNodeRows] = useState<NodeRow[]>(() => flowToNodeRows(flow));
  const [edgeRows, setEdgeRows] = useState<EdgeRow[]>(() => flowToEdgeRows(flow));
  const [cellErrors, setCellErrors] = useState<CellError[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<Set<number>>(new Set());
  const [selectedEdges, setSelectedEdges] = useState<Set<number>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 未保存状態を親に同期する（アンマウントで消える編集内容のガードに使う）
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const nodeErrors = useMemo(() => cellErrors.filter(e => e.scope === 'node'), [cellErrors]);
  const edgeErrors = useMemo(() => cellErrors.filter(e => e.scope === 'edge'), [cellErrors]);
  const warnings = useMemo(() => cellErrors.filter(e => e.severity === 'warning'), [cellErrors]);

  const revalidate = useCallback((nodes: NodeRow[], edges: EdgeRow[]) => {
    setCellErrors(validateRows(nodes, edges));
  }, []);

  // --- cell editing ---
  const handleNodeChange = (rowIndex: number, key: keyof NodeRow & string, value: string) => {
    setNodeRows(prev => {
      const next = prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r));
      return next;
    });
    setDirty(true);
  };
  const handleEdgeChange = (rowIndex: number, key: keyof EdgeRow & string, value: string) => {
    setEdgeRows(prev => prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r)));
    setDirty(true);
  };

  // --- toolbar: add / delete ---
  const handleAddRow = () => {
    if (subTab === 'nodes') {
      setNodeRows(prev => [...prev, emptyNodeRow()]);
    } else {
      setEdgeRows(prev => [...prev, emptyEdgeRow()]);
    }
    setDirty(true);
  };

  const applyNodeDelete = () => {
    const next = nodeRows.filter((_, i) => !selectedNodes.has(i));
    setNodeRows(next);
    setSelectedNodes(new Set());
    setDirty(true);
    revalidate(next, edgeRows);
  };

  const handleDeleteSelected = () => {
    if (subTab === 'nodes') {
      if (selectedNodes.size === 0) return;
      // 削除されるノードを参照するエッジがあれば確認する
      const deletedIds = new Set([...selectedNodes].map(i => nodeRows[i]?.id).filter(Boolean));
      const referencing = edgeRows.filter(e => deletedIds.has(e.from) || deletedIds.has(e.to));
      if (referencing.length > 0) {
        setPendingNodeDelete({ edgeIds: referencing.map(e => e.id) });
        return;
      }
      applyNodeDelete();
    } else {
      if (selectedEdges.size === 0) return;
      const next = edgeRows.filter((_, i) => !selectedEdges.has(i));
      setEdgeRows(next);
      setSelectedEdges(new Set());
      setDirty(true);
      revalidate(nodeRows, next);
    }
  };

  const toggleSelect = (rowIndex: number) => {
    const setter = subTab === 'nodes' ? setSelectedNodes : setSelectedEdges;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  // --- CSV export / import ---
  const downloadCsv = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (subTab === 'nodes') {
      downloadCsv(`${flow.id}-nodes.csv`, nodeRowsToCsv(nodeRows));
    } else {
      downloadCsv(`${flow.id}-edges.csv`, edgeRowsToCsv(edgeRows));
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルを再選択できるようリセット
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      if (subTab === 'nodes') {
        const { rows, errors } = parseNodeCsv(text);
        if (errors.length > 0) {
          addToast('error', `CSV取込エラー: ${errors.join(' / ')}`);
          return;
        }
        setNodeRows(rows);
        setSelectedNodes(new Set());
        setDirty(true);
        revalidate(rows, edgeRows);
      } else {
        const { rows, errors } = parseEdgeCsv(text);
        if (errors.length > 0) {
          addToast('error', `CSV取込エラー: ${errors.join(' / ')}`);
          return;
        }
        setEdgeRows(rows);
        setSelectedEdges(new Set());
        setDirty(true);
        revalidate(nodeRows, rows);
      }
      addToast('info', 'CSVを取り込みました。内容を確認して保存してください。');
    };
    reader.onerror = () => addToast('error', 'ファイルの読み込みに失敗しました');
    reader.readAsText(file);
  };

  // --- save (grid-proposal -> optional apply) ---
  const handleSave = async () => {
    const errors = validateRows(nodeRows, edgeRows);
    setCellErrors(errors);
    if (hasBlockingErrors(errors)) {
      addToast('error', '入力エラーがあります。赤枠のセルを修正してください。');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/flows/${encodeURIComponent(flow.id)}/grid-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeRows, edgeRows, baseHash }),
      });
      const json = await res.json().catch(() => null);

      if (res.status === 409) {
        addToast(
          'error',
          '他の人が先にこのフローを更新しました。ページを更新してもう一度編集してください'
        );
        return;
      }
      if (!res.ok || !json?.ok) {
        // CellError[] が details に入っていればハイライト
        const details = json?.details;
        if (typeof details === 'string') {
          try {
            const parsed = JSON.parse(details);
            if (Array.isArray(parsed)) {
              setCellErrors(parsed as CellError[]);
              addToast('error', '検証エラーがあります。赤枠のセルを修正してください。');
              return;
            }
          } catch {
            /* not JSON */
          }
          addToast('error', details);
          return;
        }
        addToast('error', `保存に失敗しました${isTechMode ? ` (HTTP ${res.status})` : ''}`);
        return;
      }

      const proposalId: string | undefined = json.data?.proposal?.id;
      setDirty(false);
      addToast('success', '改善案を作成しました。承認待ち一覧から確認できます。');

      if (proposalId) {
        setPendingApplyId(proposalId);
      }
    } catch {
      addToast('error', '保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  /** 作成済みの改善案を即時適用する(確認ダイアログの確定時に呼ぶ)。 */
  const handleApplyNow = async (proposalId: string) => {
    setPendingApplyId(null);
    try {
      const applyRes = await fetch(`/api/proposals/${proposalId}/apply`, { method: 'POST' });
      if (applyRes.ok) {
        addToast('success', '反映しました。');
        window.location.reload();
      } else {
        addToast('error', '反映に失敗しました。承認待ち一覧から再試行してください。');
      }
    } catch {
      addToast('error', '反映に失敗しました。承認待ち一覧から再試行してください。');
    }
  };

  const blockingCount = cellErrors.filter(e => e.severity === 'error').length;

  return (
    <div className="space-y-3">
      {/* サブタブ + ツールバー */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          <button
            type="button"
            onClick={() => setSubTab('nodes')}
            className={`px-3 py-1.5 text-sm font-medium ${
              subTab === 'nodes'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            ノード ({nodeRows.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('edges')}
            className={`px-3 py-1.5 text-sm font-medium ${
              subTab === 'edges'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            エッジ ({edgeRows.length})
          </button>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <Plus className="w-4 h-4" />
          行を追加
        </button>
        <button
          type="button"
          onClick={handleDeleteSelected}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
          選択行を削除
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <Download className="w-4 h-4" />
          CSVエクスポート
        </button>
        <button
          type="button"
          onClick={handleImportClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <Upload className="w-4 h-4" />
          CSVインポート
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileSelected}
          className="hidden"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg"
        >
          <Save className="w-4 h-4" />
          {saving ? '申請中...' : '保存して反映を申請'}
        </button>
      </div>

      {/* 注意書き */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {isTechMode
          ? '正本は YAML/Git です。保存すると改善案(Proposal)が作成され、適用時に Git コミットされます。CSVは Excel で編集できます(UTF-8 BOM付き)。'
          : '保存すると承認待ちに改善案として登録されます。CSVは Excel で編集できます。'}
      </p>

      {/* 警告 / エラー件数 */}
      {(warnings.length > 0 || blockingCount > 0) && (
        <div className="flex flex-col gap-1">
          {blockingCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
              入力エラー {blockingCount} 件: 赤枠のセルを修正してください
            </div>
          )}
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle className="w-4 h-4" />
              {w.message}
            </div>
          ))}
        </div>
      )}

      {/* グリッド */}
      {subTab === 'nodes' ? (
        <EditableGrid
          columns={NODE_COLUMNS}
          rows={nodeRows}
          errors={nodeErrors}
          onCellChange={handleNodeChange}
          selected={selectedNodes}
          onToggleSelect={toggleSelect}
          onBlur={() => revalidate(nodeRows, edgeRows)}
        />
      ) : (
        <EditableGrid
          columns={EDGE_COLUMNS}
          rows={edgeRows}
          errors={edgeErrors}
          onCellChange={handleEdgeChange}
          selected={selectedEdges}
          onToggleSelect={toggleSelect}
          onBlur={() => revalidate(nodeRows, edgeRows)}
        />
      )}

      {/* 参照エッジがあるノード削除の確認 */}
      <ConfirmDialog
        isOpen={pendingNodeDelete !== null}
        onConfirm={() => {
          setPendingNodeDelete(null);
          applyNodeDelete();
        }}
        onCancel={() => setPendingNodeDelete(null)}
        title="選択したステップを削除しますか？"
        description={`削除するステップにつながっている線が ${pendingNodeDelete?.edgeIds.length ?? 0} 件あります。`}
        whatHappens={[
          `つながりが残ったままになります（${(pendingNodeDelete?.edgeIds ?? []).join(', ')}）`,
          '削除後に、線の始点/終点を直す必要があります',
          'まだ申請していないので、保存しなければ元のままです',
        ]}
        confirmLabel="削除する"
        confirmColor="red"
      />

      {/* 改善案の即時反映確認 */}
      <ConfirmDialog
        isOpen={pendingApplyId !== null}
        onConfirm={() => {
          if (pendingApplyId) void handleApplyNow(pendingApplyId);
        }}
        onCancel={() => setPendingApplyId(null)}
        title="今すぐ反映しますか？"
        description="改善案を作成しました。承認を待たずに今すぐ反映することもできます。"
        whatHappens={[
          '「あとで」を選ぶと、承認待ち一覧に残ります',
          '「今すぐ反映」を選ぶと、この場でフローが更新されます',
        ]}
        confirmLabel="今すぐ反映"
        confirmColor="green"
      />
    </div>
  );
}
