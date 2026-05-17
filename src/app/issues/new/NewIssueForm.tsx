'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { FlowSummary } from '@/lib/flow-service';
import { Loader2, ArrowLeft, Lightbulb } from 'lucide-react';
import Link from 'next/link';

interface NewIssueFormProps {
  flows: FlowSummary[];
  defaultFlowId?: string;
  defaultNodeId?: string;
}

type FieldErrors = {
  title?: string;
  description?: string;
};

export function NewIssueForm({ flows, defaultFlowId, defaultNodeId }: NewIssueFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetFlowId: defaultFlowId || '',
    targetNodeId: defaultNodeId || '',
  });

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!formData.title.trim()) {
      next.title = 'タイトルを入力してください';
    } else if (formData.title.trim().length < 3) {
      next.title = 'タイトルは3文字以上で入力してください';
    }
    if (!formData.description.trim()) {
      next.description = '説明を入力してください';
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (nextErrors.title) titleRef.current?.focus();
      else if (nextErrors.description) descriptionRef.current?.focus();
      addToast('error', '入力内容を確認してください');
      return;
    }

    setErrors({});
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
        throw new Error(data.details || '課題の作成に失敗しました');
      }

      addToast('success', `課題 ${data.data.humanId} を作成しました`);
      router.push(`/issues/${data.data.id}`);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : '課題の作成に失敗しました');
      setIsSubmitting(false);
    }
  };

  const inputBaseClass =
    'w-full px-4 py-2.5 min-h-11 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus:border-transparent';

  const fieldClass = (hasError: boolean) =>
    `${inputBaseClass} ${
      hasError ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
    }`;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
      noValidate
      aria-label="新しい課題の作成フォーム"
    >
      <Link
        href="/issues"
        className="inline-flex items-center gap-1 min-h-11 px-2 -ml-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        課題一覧に戻る
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">新しい課題を作成</h1>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
          フローの改善点や課題を記録します。作成後、AIが改善案を自動生成できます。
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span className="text-red-600 dark:text-red-400" aria-hidden="true">
            *
          </span>{' '}
          は必須項目です。
        </p>
      </div>

      {/* ヒント */}
      <aside
        className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3"
        aria-label="課題作成のヒント"
      >
        <Lightbulb
          className="w-5 h-5 text-blue-700 dark:text-blue-300 flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="text-sm text-blue-900 dark:text-blue-100">
          <p className="font-medium">良い課題の書き方</p>
          <ul className="mt-1 space-y-0.5 text-blue-900 dark:text-blue-200 list-disc list-inside">
            <li>現在の状態と期待される状態を明確に記述する</li>
            <li>対象フローとノードを指定すると、AIがより正確な提案を生成できます</li>
            <li>具体的な改善案がある場合は説明に含めると効果的です</li>
          </ul>
        </div>
      </aside>

      {/* Title */}
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-gray-800 dark:text-gray-100 mb-1"
        >
          タイトル{' '}
          <span className="text-red-600 dark:text-red-400" aria-hidden="true">
            *
          </span>
          <span className="sr-only">（必須）</span>
        </label>
        <input
          ref={titleRef}
          type="text"
          id="title"
          required
          aria-required="true"
          aria-invalid={errors.title ? 'true' : 'false'}
          aria-describedby={errors.title ? 'title-error' : 'title-hint'}
          value={formData.title}
          onChange={e => {
            setFormData(prev => ({ ...prev, title: e.target.value }));
            if (errors.title) setErrors(prev => ({ ...prev, title: undefined }));
          }}
          placeholder="例: 承認フローにマネージャー確認ステップを追加"
          className={fieldClass(!!errors.title)}
          maxLength={200}
        />
        {errors.title ? (
          <p
            id="title-error"
            role="alert"
            className="mt-1 text-sm text-red-700 dark:text-red-300 font-medium"
          >
            {errors.title}
          </p>
        ) : (
          <p id="title-hint" className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            一覧で見て内容が分かる短い文にしてください（200文字以内）
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="flex items-center text-sm font-medium text-gray-800 dark:text-gray-100 mb-1"
        >
          説明{' '}
          <span className="text-red-600 dark:text-red-400 ml-0.5" aria-hidden="true">
            *
          </span>
          <span className="sr-only">（必須）</span>
          <HelpTooltip
            content="AIが改善案を生成する際にこの説明を参考にします。具体的に書くほど精度が上がります。"
            className="ml-1"
          />
        </label>
        <textarea
          ref={descriptionRef}
          id="description"
          required
          aria-required="true"
          aria-invalid={errors.description ? 'true' : 'false'}
          aria-describedby={errors.description ? 'description-error' : undefined}
          value={formData.description}
          onChange={e => {
            setFormData(prev => ({ ...prev, description: e.target.value }));
            if (errors.description) setErrors(prev => ({ ...prev, description: undefined }));
          }}
          placeholder="現在の問題点、期待される動作、改善案などを記述してください"
          rows={6}
          className={`${fieldClass(!!errors.description)} resize-y min-h-32`}
        />
        {errors.description && (
          <p
            id="description-error"
            role="alert"
            className="mt-1 text-sm text-red-700 dark:text-red-300 font-medium"
          >
            {errors.description}
          </p>
        )}
      </div>

      {/* Target Flow */}
      <div>
        <label
          htmlFor="targetFlowId"
          className="flex items-center text-sm font-medium text-gray-800 dark:text-gray-100 mb-1"
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
          onChange={e => setFormData(prev => ({ ...prev, targetFlowId: e.target.value }))}
          className={fieldClass(false)}
        >
          <option value="">フローを選択（任意）</option>
          {flows.map(flow => (
            <option key={flow.id} value={flow.id}>
              {flow.title} ({flow.id})
            </option>
          ))}
        </select>
        {flows.length === 0 && (
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
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
            className="flex items-center text-sm font-medium text-gray-800 dark:text-gray-100 mb-1"
          >
            対象ノードID
            <HelpTooltip
              content="フロー内の特定のノード（ステップ）を指定します。フロー画面でノードをクリックするとIDを確認できます。"
              className="ml-1"
            />
          </label>
          <input
            type="text"
            id="targetNodeId"
            value={formData.targetNodeId}
            onChange={e => setFormData(prev => ({ ...prev, targetNodeId: e.target.value }))}
            placeholder="例: receive_order"
            className={fieldClass(false)}
          />
        </div>
      )}

      {/* Submit Button */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
        <Link
          href="/issues"
          className="inline-flex items-center justify-center px-6 py-2.5 min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          キャンセル
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-11 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 font-medium"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? '作成中...' : '課題を作成'}
        </button>
      </div>
    </form>
  );
}
