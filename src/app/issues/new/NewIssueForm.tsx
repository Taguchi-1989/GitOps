/**
 * FlowOps - New Issue Form
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useToast } from '@/components/ui/Toast';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { FlowSummary } from '@/lib/flow-service';
import { Loader2, ArrowLeft, Lightbulb, MousePointerClick } from 'lucide-react';
import Link from 'next/link';
import type { Flow } from '@/core/parser/schema';

// SSR無効でFlowCanvasを読み込む（ReactFlowはSSR非対応）
const FlowCanvas = dynamic(() => import('@/components/flow/editor/FlowCanvas'), { ssr: false });

interface NewIssueFormProps {
  flows: FlowSummary[];
  defaultFlowId?: string;
  defaultNodeId?: string;
}

export function NewIssueForm({ flows, defaultFlowId, defaultNodeId }: NewIssueFormProps) {
  const router = useRouter();
  const { addToast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetFlowId: defaultFlowId || '',
    targetNodeId: defaultNodeId || '',
  });

  // フロープレビュー用の状態
  const [previewFlow, setPreviewFlow] = useState<Flow | null>(null);
  const [isFetchingFlow, setIsFetchingFlow] = useState(false);
  const [selectedNodeLabel, setSelectedNodeLabel] = useState<string | null>(null);

  // targetFlowId が変わったらフローデータをフェッチ
  useEffect(() => {
    if (!formData.targetFlowId) {
      setPreviewFlow(null);
      setSelectedNodeLabel(null);
      return;
    }
    let cancelled = false;
    setIsFetchingFlow(true);
    fetch(`/api/flows/${formData.targetFlowId}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.ok && data.data?.flow) {
          setPreviewFlow(data.data.flow as Flow);
        } else {
          setPreviewFlow(null);
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewFlow(null);
      })
      .finally(() => {
        if (!cancelled) setIsFetchingFlow(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.targetFlowId]);

  // ノードクリック時: targetNodeId を自動入力し、ノード名を表示
  const handleNodeClick = (nodeId: string) => {
    setFormData(prev => ({ ...prev, targetNodeId: nodeId }));
    if (previewFlow) {
      const node = previewFlow.nodes[nodeId];
      setSelectedNodeLabel(node?.label ?? nodeId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      addToast('error', 'タイトルを入力してください');
      return;
    }

    if (!formData.description.trim()) {
      addToast('error', '説明を入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          targetFlowId: formData.targetFlowId || undefined,
          targetNodeId: formData.targetNodeId || undefined,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.details || 'Issueの作成に失敗しました');
      }

      addToast('success', `Issue ${data.data.humanId} を作成しました`);
      router.push(`/issues/${data.data.id}`);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Issueの作成に失敗しました');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link
        href="/issues"
        className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ArrowLeft className="w-4 h-4" />
        Issue一覧に戻る
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">新しいIssueを作成</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          フローの改善点や課題を記録します。作成後、AIが改善案を自動生成できます。
        </p>
      </div>

      {/* 2カラムレイアウト: モバイル1列 / lg以上2列 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 左カラム: フォーム */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ヒント */}
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex gap-3">
            <Lightbulb className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">良いIssueの書き方</p>
              <ul className="mt-1 space-y-0.5 text-blue-700 dark:text-blue-400">
                <li>- 現在の状態と期待される状態を明確に記述する</li>
                <li>- 対象フローとノードを指定すると、AIがより正確な提案を生成できます</li>
                <li>- 具体的な改善案がある場合は説明に含めると効果的です</li>
              </ul>
            </div>
          </div>

          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="例: 承認フローにマネージャー確認ステップを追加"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              説明 <span className="text-red-500">*</span>
              <HelpTooltip
                content="AIが改善案を生成する際にこの説明を参考にします。具体的に書くほど精度が上がります。"
                className="ml-1"
              />
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="現在の問題点、期待される動作、改善案などを記述してください"
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Target Flow */}
          <div>
            <label
              htmlFor="targetFlowId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              対象フロー
              <HelpTooltip
                content="改善対象のフローを指定すると、AIがそのフロー定義を分析して改善案を生成します。"
                className="ml-1"
              />
            </label>
            <select
              id="targetFlowId"
              value={formData.targetFlowId}
              onChange={e => {
                setFormData(prev => ({ ...prev, targetFlowId: e.target.value, targetNodeId: '' }));
                setSelectedNodeLabel(null);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">フローを選択（任意）</option>
              {flows.map(flow => (
                <option key={flow.id} value={flow.id}>
                  {flow.title} ({flow.id})
                </option>
              ))}
            </select>
            {flows.length === 0 && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                フローが登録されていません。
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">spec/flows/</code>{' '}
                にYAMLファイルを追加してください。
              </p>
            )}
          </div>

          {/* Target Node ID */}
          {formData.targetFlowId && (
            <div>
              <label
                htmlFor="targetNodeId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                対象ノードID
                <HelpTooltip
                  content="右のダイアグラムでノードをクリックすると自動入力されます。"
                  className="ml-1"
                />
              </label>
              <input
                type="text"
                id="targetNodeId"
                value={formData.targetNodeId}
                onChange={e => {
                  setFormData(prev => ({ ...prev, targetNodeId: e.target.value }));
                  setSelectedNodeLabel(null);
                }}
                placeholder="例: receive_order（右のダイアグラムからも選択可）"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {selectedNodeLabel && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <MousePointerClick className="w-3 h-3" />
                  選択中: {selectedNodeLabel}
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-2">
            <Link
              href="/issues"
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              キャンセル
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Issueを作成
            </button>
          </div>
        </form>

        {/* 右カラム: フロープレビュー */}
        <div className="lg:sticky lg:top-6">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                フローダイアグラム
              </p>
              {formData.targetFlowId && previewFlow && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                  <MousePointerClick className="w-3 h-3" />
                  ノードをクリックで対象ノードIDを入力
                </p>
              )}
            </div>

            <div className="h-[480px] flex items-center justify-center">
              {!formData.targetFlowId && (
                <p className="text-sm text-gray-400 dark:text-gray-500 px-6 text-center">
                  フローを選択するとダイアグラムが表示されます
                </p>
              )}
              {formData.targetFlowId && isFetchingFlow && (
                <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">読み込み中...</span>
                </div>
              )}
              {formData.targetFlowId && !isFetchingFlow && !previewFlow && (
                <p className="text-sm text-gray-400 dark:text-gray-500 px-6 text-center">
                  フローデータを取得できませんでした
                </p>
              )}
              {formData.targetFlowId && !isFetchingFlow && previewFlow && (
                <div className="w-full h-full">
                  <FlowCanvas
                    flow={previewFlow}
                    onNodeClick={handleNodeClick}
                    selectedNodeId={formData.targetNodeId || null}
                    editable={false}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
