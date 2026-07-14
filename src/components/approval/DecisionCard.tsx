/**
 * FlowOps - Decision Card (判断カード)
 *
 * 承認リクエストの全コンテキストを表示し、承認/差し戻しを行う。
 * Gate結果は参考情報であり、最終判断は人が行う。
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { GateOutcomeBadge, type GateOutcome } from './GateOutcomeBadge';
import { useToast } from '@/components/ui/Toast';
import { getFriendlyError, formatFriendlyToast } from '@/lib/friendly-errors';

// --------------------------------------------------------
// 型定義
// --------------------------------------------------------

export interface ValidationResult {
  ruleId: string;
  ruleType: string;
  passed: boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  coverage?: number;
  details: {
    matched: string[];
    missing: string[];
    message: string;
  };
}

export interface AssumptionItem {
  setId: string;
  setVersion: string;
  id: string;
  statement: string;
  source?: string;
}

export interface GateData {
  outcome: GateOutcome;
  results: ValidationResult[];
  assumptions: AssumptionItem[];
}

export interface DecisionCardData {
  approvalRequestId: string;
  workflowId: string;
  flowId: string;
  nodeId: string;
  nodeLabel: string;
  taskId?: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  gate: GateData | null;
}

// --------------------------------------------------------
// ヘルパー
// --------------------------------------------------------

const SEVERITY_STYLES: Record<
  'info' | 'warning' | 'error' | 'critical',
  { row: string; badge: string; label: string }
> = {
  info: {
    row: '',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    label: '情報',
  },
  warning: {
    row: '',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    label: '警告',
  },
  error: {
    row: 'bg-red-50 dark:bg-red-900/10',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    label: 'エラー',
  },
  critical: {
    row: 'bg-red-100 dark:bg-red-900/20',
    badge: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    label: '重大',
  },
};

// --------------------------------------------------------
// サブコンポーネント: 折りたたみパネル
// --------------------------------------------------------

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="
          w-full flex items-center justify-between px-4 py-2.5
          text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50
          transition-colors
        "
      >
        <span className="flex items-center gap-2">{title}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// --------------------------------------------------------
// メインコンポーネント
// --------------------------------------------------------

interface DecisionCardProps {
  data: DecisionCardData;
}

export function DecisionCard({ data }: DecisionCardProps) {
  const router = useRouter();
  const { addToast } = useToast();

  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = comment.trim().length > 0 && !isSubmitting;

  const submit = async (approved: boolean) => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/workflows/${data.workflowId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved,
          reason: comment.trim(),
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: unknown;
        errorCode?: string;
        details?: string;
      };

      if (!json.ok) {
        const friendly = getFriendlyError(json.errorCode, json.details);
        addToast(friendly.severity, formatFriendlyToast(friendly));
        return;
      }

      addToast('success', approved ? '承認しました' : '差し戻しました');
      router.refresh();
      router.push('/approvals');
    } catch {
      addToast('error', '操作に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 不足証跡を集約
  const allMissing = (data.gate?.results ?? []).flatMap(r => r.details.missing);
  const uniqueMissing = [...new Set(allMissing)];

  const failedResults = (data.gate?.results ?? []).filter(r => !r.passed);

  return (
    <div className="max-w-4xl mx-auto">
      {/* 戻るリンク */}
      <button
        onClick={() => router.push('/approvals')}
        className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        承認待ち一覧に戻る
      </button>

      {/* 人が最終判断するという案内 */}
      <div className="flex items-start gap-3 mb-6 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          Gate結果はAIによる参考情報です。<strong>最終判断は必ず担当者が行ってください。</strong>
        </span>
      </div>

      {/* カード本体 */}
      <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">対象工程</p>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {data.nodeLabel}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                {data.nodeId}
              </p>
            </div>
            {data.gate && <GateOutcomeBadge outcome={data.gate.outcome} size="lg" />}
          </div>
        </div>

        {/* 目的・対象 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            目的・対象
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">フローID</dt>
              <dd className="font-mono text-gray-900 dark:text-gray-100">{data.flowId}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">ノードID</dt>
              <dd className="font-mono text-gray-900 dark:text-gray-100">{data.nodeId}</dd>
            </div>
            {data.taskId && (
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">タスクID</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">{data.taskId}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* 前提 (Assumptions) */}
        {data.gate && data.gate.assumptions.length > 0 && (
          <CollapsibleSection title={<span className="font-medium">前提 (Assumptions)</span>}>
            <ul className="space-y-2 mt-1">
              {data.gate.assumptions.map(a => (
                <li
                  key={a.id}
                  className="text-sm text-gray-800 dark:text-gray-200 flex items-start gap-2"
                >
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>
                    {a.statement}
                    {a.source && (
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                        （出典: {a.source}）
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {/* 入力 */}
        <CollapsibleSection
          title={
            <span className="font-medium flex items-center gap-1">
              入力
              <span className="text-xs text-gray-400 font-normal">(タスクへの入力データ)</span>
            </span>
          }
        >
          <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto mt-1 leading-relaxed">
            {JSON.stringify(data.input, null, 2)}
          </pre>
        </CollapsibleSection>

        {/* Gate結果 */}
        {data.gate && data.gate.results.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Gate結果
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 text-left">
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                      ルールID
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                      深刻度
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 text-center">
                      合否
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">
                      充足率
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                      メッセージ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.gate.results.map(r => {
                    const sty = SEVERITY_STYLES[r.severity];
                    return (
                      <tr key={r.ruleId} className={sty.row}>
                        <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {r.ruleId}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${sty.badge}`}
                          >
                            {sty.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.passed ? (
                            <CheckCircle className="w-4 h-4 text-green-500 inline" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 inline" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {r.coverage !== undefined ? `${Math.round(r.coverage * 100)}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
                          {r.details.message || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 不合格ルールの matched/missing 詳細 */}
            {failedResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {failedResults.map(r => (
                  <div
                    key={`detail-${r.ruleId}`}
                    className="text-xs bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3"
                  >
                    <p className="font-medium text-red-800 dark:text-red-300 mb-1">
                      {r.ruleId} — 不合格の詳細
                    </p>
                    {r.details.matched.length > 0 && (
                      <p className="text-green-700 dark:text-green-400">
                        充足: {r.details.matched.join(', ')}
                      </p>
                    )}
                    {r.details.missing.length > 0 && (
                      <p className="text-red-700 dark:text-red-400">
                        不足: {r.details.missing.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 不足証跡チップ */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">不足証跡</h3>
          {uniqueMissing.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {uniqueMissing.map(m => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                >
                  <AlertTriangle className="w-3 h-3" />
                  {m}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              不足なし
            </p>
          )}
        </div>

        {/* 出力 (AI提案) */}
        <CollapsibleSection
          title={
            <span className="font-medium flex items-center gap-1">
              出力（AI提案）
              <span className="text-xs text-gray-400 font-normal">(タスクからの出力データ)</span>
            </span>
          }
        >
          {/* hazards テーブル */}
          {Array.isArray((data.output as Record<string, unknown>)?.hazards) &&
            ((data.output as Record<string, unknown>).hazards as unknown[]).length > 0 && (
              <div className="mt-2 mb-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900 text-left">
                      <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">
                        カテゴリ
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">
                        説明
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {(
                      (data.output as Record<string, unknown>).hazards as Array<{
                        category?: string;
                        description?: string;
                      }>
                    ).map((h, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                          {h.category ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                          {h.description ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto leading-relaxed">
            {JSON.stringify(data.output, null, 2)}
          </pre>
        </CollapsibleSection>

        {/* 操作エリア */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            判断コメント
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            承認・差し戻しのどちらの場合も、コメントを入力してください（必須）。
          </p>
          <textarea
            rows={4}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="承認理由または差し戻し理由を入力してください"
            className="
              w-full rounded-lg border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800 px-3 py-2
              text-sm text-gray-900 dark:text-gray-100
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              placeholder:text-gray-400 dark:placeholder:text-gray-500
            "
          />

          <div className="flex items-center gap-3 mt-3">
            {/* 承認ボタン */}
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={!canSubmit}
              className="
                flex items-center gap-2 px-4 py-2
                bg-green-600 text-white rounded-lg
                hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors font-medium text-sm
              "
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              承認する
            </button>

            {/* 差し戻しボタン */}
            <button
              type="button"
              onClick={() => void submit(false)}
              disabled={!canSubmit}
              className="
                flex items-center gap-2 px-4 py-2
                bg-red-600 text-white rounded-lg
                hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors font-medium text-sm
              "
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              差し戻す
            </button>

            {!comment.trim() && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                コメントを入力するとボタンが有効になります
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
