/**
 * FlowOps - 改善カード作成フォーム
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useToast } from '@/components/ui/Toast';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { FlowSummary } from '@/lib/flow-service';
import {
  Loader2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  MousePointerClick,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import type { Flow } from '@/core/parser/schema';

const FlowCanvas = dynamic(() => import('@/components/flow/editor/FlowCanvas'), { ssr: false });

const TEMPLATE_TEXT = `【困っていること】

【いつ起きる】

【どれくらい困る】

【こうなってほしい】

【まず試したいこと】

【効果の見方】
`;

interface NewIssueFormProps {
  flows: FlowSummary[];
  flowsMap: Record<string, Flow>;
  defaultFlowId?: string;
  defaultNodeId?: string;
}

export function NewIssueForm({ flows, flowsMap, defaultFlowId, defaultNodeId }: NewIssueFormProps) {
  const router = useRouter();
  const { addToast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPlanFields, setShowPlanFields] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetFlowId: defaultFlowId || '',
    targetNodeId: defaultNodeId || '',
    currentSituation: '',
    frequency: '',
    impact: '',
    expectedState: '',
    hypothesisCause: '',
    successMetric: '',
    checkDueDate: '',
  });

  const previewFlow = formData.targetFlowId ? (flowsMap[formData.targetFlowId] ?? null) : null;
  const [selectedNodeLabel, setSelectedNodeLabel] = useState<string | null>(null);

  const handleNodeClick = (nodeId: string) => {
    setFormData(prev => ({ ...prev, targetNodeId: nodeId }));
    if (previewFlow) {
      const node = previewFlow.nodes[nodeId];
      setSelectedNodeLabel(node?.label ?? nodeId);
    }
  };

  const applyTemplate = () => {
    setFormData(prev => ({ ...prev, description: TEMPLATE_TEXT }));
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
      const body: Record<string, string | undefined> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        targetFlowId: formData.targetFlowId || undefined,
        targetNodeId: formData.targetNodeId || undefined,
        currentSituation: formData.currentSituation || undefined,
        frequency: formData.frequency || undefined,
        impact: formData.impact || undefined,
        expectedState: formData.expectedState || undefined,
        hypothesisCause: formData.hypothesisCause || undefined,
        successMetric: formData.successMetric || undefined,
        checkDueDate: formData.checkDueDate
          ? new Date(formData.checkDueDate).toISOString()
          : undefined,
      };

      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.details || '改善カードの作成に失敗しました');

      addToast('success', `改善カード ${data.data.humanId} を作成しました`);
      router.push(`/issues/${data.data.id}`);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : '改善カードの作成に失敗しました');
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const textareaClass = `${inputClass} resize-none`;

  return (
    <div className="space-y-4">
      <Link
        href="/issues"
        className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ArrowLeft className="w-4 h-4" />
        改善カード一覧に戻る
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">改善カードを作る</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          現場の困りごとを記録して、PDCAサイクルで改善を進めましょう。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 左カラム: フォーム */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* テンプレートヒント */}
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex items-start justify-between gap-3">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">5分で書ける改善カード</p>
              <p className="text-blue-700 dark:text-blue-400 mt-0.5">
                テンプレートを使うと困りごとをすぐに整理できます
              </p>
            </div>
            <button
              type="button"
              onClick={applyTemplate}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-800 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              テンプレートを使う
            </button>
          </div>

          {/* タイトル */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              改善カードのタイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="例: 承認フローの手戻りが多い"
              className={inputClass}
              maxLength={200}
            />
          </div>

          {/* 説明 */}
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
              placeholder="現在の問題点、期待される動作などを記述してください"
              rows={6}
              className={textareaClass}
            />
          </div>

          {/* Plan フィールド（アコーディオン） */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPlanFields(!showPlanFields)}
              className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
            >
              <span className="flex items-center gap-2">
                📋 Planフェーズの詳細情報（任意）
                <span className="text-xs font-normal text-gray-500">AIの提案精度が上がります</span>
              </span>
              {showPlanFields ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showPlanFields && (
              <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    現状の困りごと
                  </label>
                  <textarea
                    rows={2}
                    value={formData.currentSituation}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, currentSituation: e.target.value }))
                    }
                    placeholder="例: 書類の確認に毎回3人の承認が必要で時間がかかる"
                    className={textareaClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    発生頻度
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={e => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">選択してください</option>
                    <option value="daily">毎日</option>
                    <option value="weekly">週に数回</option>
                    <option value="monthly">月に数回</option>
                    <option value="irregular">不定期</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    影響
                  </label>
                  <textarea
                    rows={2}
                    value={formData.impact}
                    onChange={e => setFormData(prev => ({ ...prev, impact: e.target.value }))}
                    placeholder="例: 対応に1件あたり30分かかり、月に20件発生している"
                    className={textareaClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    期待する状態
                  </label>
                  <textarea
                    rows={2}
                    value={formData.expectedState}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, expectedState: e.target.value }))
                    }
                    placeholder="例: 一次承認者が確認後、自動的に次のステップへ進む"
                    className={textareaClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    原因の仮説
                  </label>
                  <textarea
                    rows={2}
                    value={formData.hypothesisCause}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, hypothesisCause: e.target.value }))
                    }
                    placeholder="例: 承認者が揃う条件が明確でなく、毎回確認が発生している"
                    className={textareaClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    効果を測る指標
                  </label>
                  <textarea
                    rows={2}
                    value={formData.successMetric}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, successMetric: e.target.value }))
                    }
                    placeholder="例: 承認にかかる時間が30分→10分以下になること"
                    className={textareaClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    効果確認の予定日
                  </label>
                  <input
                    type="date"
                    value={formData.checkDueDate}
                    onChange={e => setFormData(prev => ({ ...prev, checkDueDate: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 対象フロー */}
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
              className={inputClass}
            >
              <option value="">フローを選択（任意）</option>
              {flows.map(flow => (
                <option key={flow.id} value={flow.id}>
                  {flow.title} ({flow.id})
                </option>
              ))}
            </select>
          </div>

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
                placeholder="例: receive_order"
                className={inputClass}
              />
              {selectedNodeLabel && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <MousePointerClick className="w-3 h-3" />
                  選択中: {selectedNodeLabel}
                </p>
              )}
            </div>
          )}

          {/* Submit */}
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
              改善カードを作成
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
              {formData.targetFlowId && !previewFlow && (
                <p className="text-sm text-gray-400 dark:text-gray-500 px-6 text-center">
                  フローデータが見つかりませんでした
                </p>
              )}
              {formData.targetFlowId && previewFlow && (
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
