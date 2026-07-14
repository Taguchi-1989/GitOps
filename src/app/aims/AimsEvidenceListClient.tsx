'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, ArrowRight, BrainCircuit, FilePlus2, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatDateWithYear } from '@/lib/format-date';

interface EvidenceSummary {
  id: string;
  evidenceId: string;
  title: string;
  sourceType: string;
  sourceLabel: string | null;
  sourceHash: string;
  sensitivityLevel: string;
  status: string;
  tags: string[];
  reviewCount: number;
  createdAt: string;
}

export function AimsEvidenceListClient({
  initialEvidence,
}: {
  initialEvidence: EvidenceSummary[];
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceType, setSourceType] = useState('historical-text');
  const [sourceLabel, setSourceLabel] = useState('');
  const [sensitivityLevel, setSensitivityLevel] = useState('L2');
  const [tags, setTags] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/aims/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          sourceText,
          sourceType,
          sourceLabel: sourceLabel || undefined,
          sensitivityLevel,
          tags: tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.details || '取込に失敗しました');
      addToast('success', '過去資料をAIMS証拠として取り込みました');
      setTitle('');
      setSourceText('');
      setSourceLabel('');
      setTags('');
      setShowForm(false);
      router.refresh();
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : '取込に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              AIMS証拠レビュー
            </h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
            過去資料を原文のまま正本化し、複数AIの独立レビュー、統合、人の判断を分けて記録します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(value => !value)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <FilePlus2 className="h-4 w-4" />
          過去資料を取り込む
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        AI出力は監査準備のための助言です。適合・認証の結論ではなく、最後に権限者の理由付き判断が必要です。
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">証拠原文の取込</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
              <span>タイトル *</span>
              <input
                required
                maxLength={200}
                value={title}
                onChange={event => setTitle(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
              <span>資料種別</span>
              <input
                value={sourceType}
                onChange={event => setSourceType(event.target.value)}
                placeholder="meeting-minutes / incident-log"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
              <span>元資料の識別子・場所</span>
              <input
                value={sourceLabel}
                onChange={event => setSourceLabel(event.target.value)}
                placeholder="legacy-share/review-2025Q4.txt"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
              <span>機密レベル</span>
              <select
                value={sensitivityLevel}
                onChange={event => setSensitivityLevel(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
              >
                {['L0', 'L1', 'L2', 'L3', 'L4', 'L5'].map(level => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <span>タグ（カンマ区切り）</span>
            <input
              value={tags}
              onChange={event => setTags(event.target.value)}
              placeholder="operations, quarterly-review"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          <label className="block space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <span>原文テキスト *</span>
            <textarea
              required
              maxLength={500000}
              rows={12}
              value={sourceText}
              onChange={event => setSourceText(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
            />
            <span className="block text-xs text-gray-500">
              {sourceText.length.toLocaleString()} / 500,000文字
            </span>
          </label>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              正本として保存
            </button>
          </div>
        </form>
      )}

      {initialEvidence.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <Archive className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-gray-600 dark:text-gray-400">AIMS証拠はまだありません</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {initialEvidence.map(item => (
            <Link
              key={item.id}
              href={`/aims/${item.id}`}
              className="group rounded-xl border border-gray-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                    {item.evidenceId}
                  </p>
                  <h2 className="mt-1 font-semibold text-gray-900 group-hover:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-300">
                    {item.title}
                  </h2>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-700">
                  {item.sourceType}
                </span>
                <span className="rounded-full bg-purple-50 px-2 py-1 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {item.sensitivityLevel}
                </span>
                <span className={statusClass(item.status)}>{statusLabel(item.status)}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  <ShieldCheck className="h-3 w-3" /> {item.reviewCount} reviews
                </span>
              </div>
              {item.tags.length > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  {item.tags.map(tag => `#${tag}`).join(' ')}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{item.sourceLabel || '元資料ラベルなし'}</span>
                <span>{formatDateWithYear(item.createdAt)}</span>
              </div>
              <p className="mt-2 truncate font-mono text-xs text-gray-400">
                SHA-256 {item.sourceHash}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function statusLabel(status: string): string {
  return (
    {
      imported: '取込済み',
      'under-review': 'レビュー中',
      reviewed: '要判断',
      approved: '承認済み',
      rejected: '却下',
    }[status] || status
  );
}

function statusClass(status: string): string {
  const color =
    status === 'approved'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      : status === 'rejected'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        : status === 'under-review'
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return `rounded-full px-2 py-1 ${color}`;
}
