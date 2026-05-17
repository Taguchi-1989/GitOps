'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { FlowSummary } from '@/lib/flow-service';
import { Loader2, ArrowLeft, Lightbulb, Heart, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import type { IssueKind } from '@/core/issue';

interface NewIssueFormProps {
  flows: FlowSummary[];
  defaultFlowId?: string;
  defaultNodeId?: string;
  kind?: IssueKind;
}

const COPY = {
  problem: {
    Icon: AlertCircle,
    iconColor: 'text-red-600 dark:text-red-400',
    pageTitle: '新しい課題を作成',
    pageDescription: 'フローの改善点や課題を記録します。作成後、AIが改善案を自動生成できます。',
    tipsTitle: '良い課題の書き方',
    tips: [
      '現在の状態と期待される状態を明確に記述する',
      '対象フローとノードを指定すると、AIがより正確な提案を生成できます',
      '具体的な改善案がある場合は説明に含めると効果的です',
    ],
    titlePlaceholder: '例: 承認フローにマネージャー確認ステップを追加',
    descriptionPlaceholder: '現在の問題点、期待される動作、改善案などを記述してください',
    submitLabel: '課題を作成',
    submittingLabel: '作成中...',
    successPrefix: '課題',
    failureMessage: '課題の作成に失敗しました',
    backLabel: '課題一覧に戻る',
    submitColor: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-400',
  },
  praise: {
    Icon: Heart,
    iconColor: 'text-pink-600 dark:text-pink-400',
    pageTitle: '感謝・成功事例を送る',
    pageDescription:
      '「このフローのおかげで助かった」「うまくいった」を記録して、チームで共有しましょう。',
    tipsTitle: '良い感謝の書き方',
    tips: [
      '誰の・どのフローのおかげで、何が良かったかを書く',
      '対象フローを指定すると、ダッシュボードでフロー別に集計できます',
      '具体的なエピソードがあると伝わりやすくなります',
    ],
    titlePlaceholder: '例: 受注フローのおかげで初日からスムーズに業務できました',
    descriptionPlaceholder: 'どんな場面で・どう役立ったか・誰に感謝したいか などを書いてください',
    submitLabel: '感謝を送る',
    submittingLabel: '送信中...',
    successPrefix: '感謝',
    failureMessage: '感謝の送信に失敗しました',
    backLabel: '一覧に戻る',
    submitColor: 'bg-pink-600 hover:bg-pink-700 focus-visible:ring-pink-400',
  },
} as const;

type FieldErrors = {
  title?: string;
  description?: string;
};

export function NewIssueForm({
  flows,
  defaultFlowId,
  defaultNodeId,
  kind = 'problem',
}: NewIssueFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const copy = COPY[kind];
  const { Icon: HeaderIcon } = copy;
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
          kind,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.details || copy.failureMessage);
      }

      addToast('success', `${copy.successPrefix} ${data.data.humanId} を作成しました`);
      router.push(`/issues/${data.data.id}`);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : copy.failureMessage);
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
      aria-label={`${copy.pageTitle}フォーム`}
    >
      <Link
        href="/issues"
        className="inline-flex items-center gap-1 min-h-11 px-2 -ml-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {copy.backLabel}
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <HeaderIcon className={`w-6 h-6 ${copy.iconColor}`} aria-hidden="true" />
          {copy.pageTitle}
        </h1>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{copy.pageDescription}</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span className="text-red-600 dark:text-red-400" aria-hidden="true">
            *
          </span>{' '}
          は必須項目です。
        </p>
      </div>

      <aside
        className={
          kind === 'praise'
            ? 'bg-pink-50 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-800 rounded-lg p-4 flex gap-3'
            : 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3'
        }
        aria-label={`${copy.pageTitle}のヒント`}
      >
        <Lightbulb
          className={
            kind === 'praise'
              ? 'w-5 h-5 text-pink-700 dark:text-pink-300 flex-shrink-0 mt-0.5'
              : 'w-5 h-5 text-blue-700 dark:text-blue-300 flex-shrink-0 mt-0.5'
          }
          aria-hidden="true"
        />
        <div
          className={
            kind === 'praise'
              ? 'text-sm text-pink-900 dark:text-pink-100'
              : 'text-sm text-blue-900 dark:text-blue-100'
          }
        >
          <p className="font-medium">{copy.tipsTitle}</p>
          <ul className="mt-1 space-y-0.5 list-disc list-inside">
            {copy.tips.map(t => (
              <li key={t}>{t}</li>
            ))}
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
          placeholder={copy.titlePlaceholder}
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
          placeholder={copy.descriptionPlaceholder}
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
          className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-11 text-white rounded-lg disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 font-medium ${copy.submitColor}`}
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? copy.submittingLabel : copy.submitLabel}
        </button>
      </div>
    </form>
  );
}
