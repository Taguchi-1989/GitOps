'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  CircleDashed,
  FileText,
  Loader2,
  Scale,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatDateWithYear } from '@/lib/format-date';

interface ReviewOutput {
  schemaVersion?: string;
  reviewScope?: string;
  executiveSummary?: string;
  sourceSummary?: string;
  claims?: Array<{ statement: string; evidenceRefs?: string[]; confidence?: number }>;
  controlAssessments?: Array<{
    controlId: string;
    status: string;
    rationale: string;
    evidenceRefs?: string[];
  }>;
  risks?: Array<{
    id: string;
    title: string;
    description: string;
    likelihood?: string;
    impact?: string;
    treatment?: string;
    evidenceRefs?: string[];
  }>;
  findings?: Array<{
    id: string;
    category: string;
    severity: string;
    statement: string;
    recommendation?: string;
    evidenceRefs?: string[];
  }>;
  uncertainties?: string[];
  disagreements?: Array<{ topic: string; positions: string[]; resolution?: string }>;
  recommendedActions?: Array<{
    priority: string;
    action: string;
    owner?: string;
    dueHint?: string;
    controlIds?: string[];
  }>;
  humanDecisionRequired?: boolean;
  confidence?: number;
  extensions?: Record<string, unknown>;
}

interface ModelReview {
  id: string;
  reviewerId: string;
  role: string;
  provider: string;
  model: string;
  promptVersion: string;
  status: string;
  output?: ReviewOutput | null;
  outputHash?: string | null;
  error?: string | null;
  durationMs?: number | null;
  chunkCount: number;
  createdAt: string;
}

interface ReviewRun {
  id: string;
  traceId: string;
  status: string;
  strategy: string;
  objective?: string | null;
  finalOutput?: ReviewOutput | null;
  finalOutputHash?: string | null;
  humanDecision?: string | null;
  humanDecisionReason?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  initiatedBy: string;
  modelReviews: ModelReview[];
  createdAt: string;
  completedAt?: string | null;
}

interface EvidenceDetail {
  id: string;
  evidenceId: string;
  title: string;
  sourceType: string;
  sourceLabel?: string | null;
  sourceText: string;
  sourceHash: string;
  sensitivityLevel: string;
  status: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  collectedBy: string;
  createdAt: string;
  reviews: ReviewRun[];
}

export function AimsEvidenceDetailClient({ initialEvidence }: { initialEvidence: EvidenceDetail }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [objective, setObjective] = useState('');
  const [reviewerIds, setReviewerIds] = useState('');
  const [reviewing, setReviewing] = useState(false);

  async function startReview(event: FormEvent) {
    event.preventDefault();
    setReviewing(true);
    try {
      const selected = reviewerIds
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
      const response = await fetch(`/api/aims/evidence/${initialEvidence.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: objective || undefined,
          reviewerIds: selected.length > 0 ? selected : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.details || 'レビューに失敗しました');
      addToast(
        result.data.status === 'partial' ? 'warning' : 'success',
        result.data.status === 'partial'
          ? '一部のモデルが失敗しました。成功結果を保存しました'
          : '複数AIレビューと統合が完了しました'
      );
      setObjective('');
      router.refresh();
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'レビューに失敗しました');
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/aims"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-700 dark:text-gray-400 dark:hover:text-indigo-300"
      >
        <ArrowLeft className="h-4 w-4" /> AIMS証拠一覧へ
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs text-gray-500">{initialEvidence.evidenceId}</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {initialEvidence.title}
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {initialEvidence.sourceType} · {initialEvidence.sourceLabel || '元資料ラベルなし'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-purple-100 px-3 py-1 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              {initialEvidence.sensitivityLevel}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-700">
              {evidenceStatusLabel(initialEvidence.status)}
            </span>
          </div>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">取込者</dt>
            <dd className="text-gray-900 dark:text-gray-100">{initialEvidence.collectedBy}</dd>
          </div>
          <div>
            <dt className="text-gray-500">取込日時</dt>
            <dd className="text-gray-900 dark:text-gray-100">
              {formatDateWithYear(initialEvidence.createdAt)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 break-all rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          SHA-256 {initialEvidence.sourceHash}
        </p>
        <details className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">
            証拠原文を表示（{initialEvidence.sourceText.length.toLocaleString()}文字）
          </summary>
          <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap border-t border-gray-200 p-4 text-sm dark:border-gray-700">
            {initialEvidence.sourceText}
          </pre>
        </details>
      </div>

      <form
        onSubmit={startReview}
        className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-6 dark:border-indigo-800 dark:bg-indigo-900/10"
      >
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            複数AIレビューを開始
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          既定では「要約・監査・反証」の3観点を独立実行し、統合AIが不一致を整理します。原文は送信直前に機密検査されます。
        </p>
        <label className="block space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <span>レビュー目的（任意）</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={objective}
            onChange={event => setObjective(event.target.value)}
            placeholder="未処置リスク、管理策の証拠、追加確認事項を整理する"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
          />
        </label>
        <details>
          <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400">
            詳細設定: 使用するレビューID
          </summary>
          <label className="mt-2 block space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <span>カンマ区切り。空欄なら全独立レビュー担当</span>
            <input
              value={reviewerIds}
              onChange={event => setReviewerIds(event.target.value)}
              placeholder="summary-openai, audit-anthropic, challenge-local"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
        </details>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            長文や複数モデルでは完了まで数分かかる場合があります。
          </p>
          <button
            type="submit"
            disabled={reviewing || initialEvidence.status === 'under-review'}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {reviewing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Scale className="h-4 w-4" />
            )}
            {reviewing ? 'レビュー実行中…' : 'レビューを実行'}
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          レビュー履歴 ({initialEvidence.reviews.length})
        </h2>
        {initialEvidence.reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
            <CircleDashed className="mx-auto mb-2 h-8 w-8" />
            まだレビューはありません
          </div>
        ) : (
          initialEvidence.reviews.map(run => <ReviewRunCard key={run.id} run={run} />)
        )}
      </section>
    </div>
  );
}

function ReviewRunCard({ run }: { run: ReviewRun }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [decision, setDecision] = useState('approved');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canDecide = ['completed', 'partial'].includes(run.status) && !run.humanDecision;

  async function submitDecision(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch(`/api/aims/reviews/${run.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.details || '判断記録に失敗しました');
      addToast('success', '人の判断と理由を記録しました');
      router.refresh();
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : '判断記録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs text-gray-500">trace {run.traceId}</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {formatDateWithYear(run.createdAt)} · {run.strategy} · 実行者 {run.initiatedBy}
            </p>
          </div>
          <span className={runStatusClass(run.status)}>{runStatusLabel(run.status)}</span>
        </div>
        {run.objective && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">目的: {run.objective}</p>
        )}
      </div>

      {run.finalOutput && (
        <div className="p-5">
          <ReviewOutputPanel output={run.finalOutput} />
        </div>
      )}

      <details className="border-t border-gray-200 dark:border-gray-700">
        <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          モデル別レビュー ({run.modelReviews.length})
        </summary>
        <div className="grid gap-3 border-t border-gray-200 p-5 dark:border-gray-700 lg:grid-cols-2">
          {run.modelReviews.map(model => (
            <details
              key={model.id}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            >
              <summary className="cursor-pointer">
                <div className="inline-flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{model.reviewerId}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">
                    {model.role}
                  </span>
                  <span className="text-xs text-gray-500">
                    {model.provider}/{model.model}
                  </span>
                  <span className={modelStatusClass(model.status)}>{model.status}</span>
                </div>
              </summary>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div>
                  <dt>prompt</dt>
                  <dd>{model.promptVersion}</dd>
                </div>
                <div>
                  <dt>chunks / duration</dt>
                  <dd>
                    {model.chunkCount} / {model.durationMs ?? '-'} ms
                  </dd>
                </div>
              </dl>
              {model.error && (
                <p className="mt-3 rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  {model.error}
                </p>
              )}
              {model.output && (
                <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                  <ReviewOutputPanel output={model.output} compact />
                </div>
              )}
              {model.outputHash && (
                <p className="mt-3 break-all font-mono text-[10px] text-gray-400">
                  SHA-256 {model.outputHash}
                </p>
              )}
            </details>
          ))}
        </div>
      </details>

      {run.humanDecision ? (
        <div className="border-t border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center gap-2 font-semibold text-green-800 dark:text-green-300">
            <UserCheck className="h-5 w-5" /> 人の判断: {decisionLabel(run.humanDecision)}
          </div>
          <p className="mt-2 text-sm text-green-900 dark:text-green-200">
            {run.humanDecisionReason}
          </p>
          <p className="mt-2 text-xs text-green-700 dark:text-green-400">
            {run.decidedBy} · {run.decidedAt ? formatDateWithYear(run.decidedAt) : ''}
          </p>
        </div>
      ) : canDecide ? (
        <form
          onSubmit={submitDecision}
          className="space-y-3 border-t border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20"
        >
          <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
            <UserCheck className="h-5 w-5" /> 最終判断は人が記録してください
          </div>
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <select
              value={decision}
              onChange={event => setDecision(event.target.value)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm dark:border-amber-700 dark:bg-gray-900"
            >
              <option value="approved">承認</option>
              <option value="revise">修正・証拠追加</option>
              <option value="rejected">却下</option>
            </select>
            <input
              required
              maxLength={4000}
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="判断理由（必須）"
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm dark:border-amber-700 dark:bg-gray-900"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              判断を固定する
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

function ReviewOutputPanel({
  output,
  compact = false,
}: {
  output: ReviewOutput;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-indigo-600 dark:text-indigo-400" />
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">統合要約</p>
          <p className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
            {output.executiveSummary || '要約なし'}
          </p>
        </div>
      </div>
      {!compact && output.sourceSummary && (
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">資料の要点</h4>
          <p className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
            {output.sourceSummary}
          </p>
        </div>
      )}
      {output.findings && output.findings.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
            <ShieldAlert className="h-4 w-4" /> 所見 ({output.findings.length})
          </h4>
          <div className="mt-2 space-y-2">
            {output.findings.map((finding, index) => (
              <div
                key={`${finding.id}-${index}`}
                className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={severityClass(finding.severity)}>{finding.severity}</span>
                  <span className="font-medium">
                    {finding.id}: {finding.statement}
                  </span>
                </div>
                {finding.evidenceRefs && finding.evidenceRefs.length > 0 && (
                  <p className="mt-1 font-mono text-xs text-indigo-600 dark:text-indigo-400">
                    {finding.evidenceRefs.join(', ')}
                  </p>
                )}
                {finding.recommendation && (
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    対応: {finding.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {!compact && output.risks && output.risks.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
            <AlertTriangle className="h-4 w-4" /> リスク ({output.risks.length})
          </h4>
          <ul className="mt-2 space-y-2">
            {output.risks.map((risk, index) => (
              <li
                key={`${risk.id}-${index}`}
                className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <p className="font-medium">
                  {risk.id}: {risk.title}
                </p>
                <p className="mt-1 text-gray-600 dark:text-gray-400">{risk.description}</p>
                <p className="mt-1 text-xs text-gray-500">
                  likelihood {risk.likelihood} / impact {risk.impact}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!compact && output.controlAssessments && output.controlAssessments.length > 0 && (
        <details>
          <summary className="cursor-pointer font-semibold text-gray-900 dark:text-gray-100">
            管理策評価 ({output.controlAssessments.length})
          </summary>
          <div className="mt-2 space-y-2">
            {output.controlAssessments.map((control, index) => (
              <div
                key={`${control.controlId}-${index}`}
                className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <p className="font-medium">
                  {control.controlId} · {control.status}
                </p>
                <p className="mt-1 text-gray-600 dark:text-gray-400">{control.rationale}</p>
              </div>
            ))}
          </div>
        </details>
      )}
      {!compact && output.recommendedActions && output.recommendedActions.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">推奨アクション</h4>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {output.recommendedActions.map((action, index) => (
              <li key={index}>
                <span className="font-medium">[{action.priority}]</span> {action.action}
              </li>
            ))}
          </ol>
        </div>
      )}
      {!compact && output.uncertainties && output.uncertainties.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
          <h4 className="font-semibold text-amber-900 dark:text-amber-200">不確実性</h4>
          <ul className="mt-1 list-disc pl-5 text-amber-800 dark:text-amber-300">
            {output.uncertainties.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {!compact && output.disagreements && output.disagreements.length > 0 && (
        <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
          <h4 className="font-semibold text-purple-900 dark:text-purple-200">モデル間の不一致</h4>
          {output.disagreements.map((item, index) => (
            <div key={index} className="mt-2 text-purple-800 dark:text-purple-300">
              <p className="font-medium">{item.topic}</p>
              <ul className="list-disc pl-5">
                {item.positions.map((position, i) => (
                  <li key={i}>{position}</li>
                ))}
              </ul>
              {item.resolution && <p className="mt-1">整理: {item.resolution}</p>}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700">
        <span>schema {output.schemaVersion || 'unknown'}</span>
        <span>
          confidence {typeof output.confidence === 'number' ? output.confidence.toFixed(2) : '-'}
        </span>
        <span>人判断 {output.humanDecisionRequired === false ? '任意' : '必須'}</span>
      </div>
      {!compact && output.extensions && Object.keys(output.extensions).length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-gray-500">拡張出力JSON</summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded bg-gray-950 p-3 text-xs text-gray-100">
            {JSON.stringify(output.extensions, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function evidenceStatusLabel(status: string) {
  return (
    (
      {
        imported: '取込済み',
        'under-review': 'レビュー中',
        reviewed: '要判断',
        approved: '承認済み',
        rejected: '却下',
      } as Record<string, string>
    )[status] || status
  );
}

function runStatusLabel(status: string) {
  return (
    (
      { running: '実行中', completed: '完了', partial: '一部成功', failed: '失敗' } as Record<
        string,
        string
      >
    )[status] || status
  );
}

function runStatusClass(status: string) {
  const color =
    status === 'completed'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      : status === 'partial'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        : status === 'failed'
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  return `rounded-full px-3 py-1 text-xs font-medium ${color}`;
}

function modelStatusClass(status: string) {
  const color =
    status === 'success'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      : status === 'failed'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return `rounded px-1.5 py-0.5 text-xs ${color}`;
}

function severityClass(severity: string) {
  const color =
    severity === 'critical' || severity === 'high'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      : severity === 'medium'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  return `rounded px-1.5 py-0.5 text-xs font-medium ${color}`;
}

function decisionLabel(decision: string) {
  return (
    ({ approved: '承認', revise: '修正・証拠追加', rejected: '却下' } as Record<string, string>)[
      decision
    ] || decision
  );
}
