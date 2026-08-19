/**
 * FlowOps - Issue Detail Component
 *
 * 改善カード詳細画面のメインコンポーネント
 * - ステータスライフサイクルの可視化
 * - 日本語のアクションボタン
 * - コンテキストヘルプ
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from './StatusBadge';
import { StatusLifecycle } from './StatusLifecycle';
import { IssueCardData } from './IssueCard';
import { ProposalCard, ProposalData } from './ProposalCard';
import { ManualProposalWizard } from './ManualProposalWizard';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import {
  ArrowLeft,
  GitBranch,
  FileText,
  Clock,
  Play,
  Sparkles,
  CheckCircle,
  XCircle,
  History,
  Loader2,
  Search,
  Star,
  Save,
  RotateCcw,
  CalendarClock,
} from 'lucide-react';
import Link from 'next/link';
import { useDisplayMode } from '@/lib/simple-mode-context';
import { GuidedWorkflow } from '@/components/ui/GuidedWorkflow';
import { formatDateWithYear as formatDate } from '@/lib/format-date';
import { getActionLabel, ISSUE_TAB_LABELS } from '@/lib/ui-labels';
import { usePermissions } from '@/lib/use-permissions';

interface IssueDetailProps {
  issue: IssueCardData & {
    proposals?: ProposalData[];
  };
  onBack?: () => void;
  onStart?: () => void;
  onGenerateProposal?: () => void;
  onApplyProposal?: (proposalId: string) => void;
  onMergeClose?: () => void;
  onReject?: () => void;
  /** 反映済みだが効果なしとして完了する（closed-ineffective への遷移） */
  onCloseIneffective?: () => void;
  isLoading?: boolean;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  ISSUE_CREATE: '改善カードを作成',
  ISSUE_UPDATE: '改善カードを更新',
  ISSUE_START: 'Do フェーズを開始',
  ISSUE_CLOSE: 'Check フェーズへ移行',
  ISSUE_CLOSE_INEFFECTIVE: '見送りとして完了（効果なし）',
  ISSUE_DELETE: '改善カードを削除',
  ISSUE_STANDARDIZE: '標準化して完了（Act）',
  PROPOSAL_GENERATE: '改善案を生成',
  PATCH_APPLY: '改善案を適用',
  MERGE_CLOSE: 'フローに反映',
  DUPLICATE_MERGE: '重複を統合',
  GIT_COMMIT: 'コミット',
  GIT_BRANCH_CREATE: 'ブランチ作成',
  GIT_BRANCH_DELETE: 'ブランチ削除',
};

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: '毎日',
  weekly: '週に数回',
  monthly: '月に数回',
  irregular: '不定期',
};

const CHECK_RESULT_LABELS: Record<string, { label: string; color: string; hint: string }> = {
  effective: {
    label: '効果あり',
    color: 'text-green-700 bg-green-100',
    hint: '前よりよくなった。このやり方を続けたい',
  },
  ineffective: {
    label: '効果なし',
    color: 'text-red-700 bg-red-100',
    hint: '変わらなかった、または前より悪くなった',
  },
  pending: {
    label: '判断保留',
    color: 'text-yellow-700 bg-yellow-100',
    hint: 'まだ分からない。もう少し様子を見たい',
  },
};

export function IssueDetail({
  issue,
  onBack,
  onStart,
  onGenerateProposal,
  onApplyProposal,
  onMergeClose,
  onReject,
  onCloseIneffective,
  isLoading = false,
}: IssueDetailProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'proposals' | 'check' | 'history'>(
    'details'
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(false);

  // Check フォーム state
  const [checkForm, setCheckForm] = useState({
    metricBefore: issue.metricBefore ?? '',
    metricAfter: issue.metricAfter ?? '',
    checkDate: issue.checkDate
      ? new Date(issue.checkDate as string).toISOString().split('T')[0]
      : '',
    checkResult: issue.checkResult ?? '',
    learning: issue.learning ?? '',
    nextAction: issue.nextAction ?? '',
    checkDueDate: issue.checkDueDate
      ? new Date(issue.checkDueDate as string).toISOString().split('T')[0]
      : '',
  });
  // 詳しい記録は既定で畳む。既に何か書かれている場合だけ開いた状態で始める
  const [isCheckDetailsOpen, setIsCheckDetailsOpen] = useState(
    Boolean(
      issue.metricBefore ||
      issue.metricAfter ||
      issue.checkDate ||
      issue.learning ||
      issue.nextAction
    )
  );
  const [checkSaving, setCheckSaving] = useState(false);
  const [checkSaved, setCheckSaved] = useState(false);
  const [checkSaveError, setCheckSaveError] = useState(false);

  const { isSimpleMode } = useDisplayMode();
  // 権限の正本はサーバ(proxy.ts)。ここでは押しても403になる操作を出さないためだけに使う
  const { canWrite } = usePermissions();
  const router = useRouter();

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(false);
    try {
      const res = await fetch(`/api/audit?entityType=Issue&entityId=${issue.id}&limit=50`);
      const data = await res.json();
      if (data.ok && data.data?.logs) {
        setAuditLogs(data.data.logs);
      } else {
        setAuditError(true);
      }
    } catch {
      setAuditError(true);
    } finally {
      setAuditLoading(false);
    }
  }, [issue.id]);

  useEffect(() => {
    if (activeTab === 'history') {
      queueMicrotask(() => {
        void fetchAuditLogs();
      });
    }
  }, [activeTab, fetchAuditLogs]);

  /** Check フォームを保存する。成功したら true を返す */
  const saveCheck = async (): Promise<boolean> => {
    setCheckSaving(true);
    setCheckSaveError(false);
    try {
      const body: Record<string, string | undefined> = {};
      if (checkForm.metricBefore) body.metricBefore = checkForm.metricBefore;
      if (checkForm.metricAfter) body.metricAfter = checkForm.metricAfter;
      if (checkForm.checkDate) body.checkDate = new Date(checkForm.checkDate).toISOString();
      if (checkForm.checkResult) body.checkResult = checkForm.checkResult;
      if (checkForm.learning) body.learning = checkForm.learning;
      if (checkForm.nextAction) body.nextAction = checkForm.nextAction;
      if (checkForm.checkDueDate)
        body.checkDueDate = new Date(checkForm.checkDueDate).toISOString();
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setCheckSaveError(true);
        return false;
      }
      setCheckSaved(true);
      setTimeout(() => setCheckSaved(false), 3000);
      router.refresh();
      return true;
    } catch {
      setCheckSaveError(true);
      return false;
    } finally {
      setCheckSaving(false);
    }
  };

  /** Check の記録を保存してから「見送り（効果なし）」として閉じる */
  const handleSaveAndCloseIneffective = async () => {
    const saved = await saveCheck();
    if (!saved) return;
    onCloseIneffective?.();
  };

  const handleStandardize = async () => {
    try {
      const res = await fetch(`/api/issues/${issue.id}/standardize`, { method: 'POST' });
      if (!res.ok) {
        setCheckSaveError(true);
        return;
      }
      router.refresh();
    } catch {
      setCheckSaveError(true);
    }
  };

  const canStart = canWrite && (issue.status === 'new' || issue.status === 'triage');
  const canGenerateProposal = canWrite && issue.status === 'in-progress';
  const canMergeOrReject = canWrite && issue.status === 'proposed';
  /** Check フェーズから改善カードを閉じられる状態か（どの結果でも終端に進めるようにする） */
  const canCloseFromCheck = canWrite && issue.status === 'merged' && !issue.standardizedAt;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            改善カード一覧に戻る
          </button>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-mono text-gray-500 dark:text-gray-400">
                {issue.humanId}
              </span>
              <StatusBadge status={issue.status} standardizedAt={issue.standardizedAt} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{issue.title}</h1>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            {canStart && onStart && (
              <button
                onClick={onStart}
                disabled={isLoading}
                className="
                  flex items-center gap-2 px-4 py-2
                  bg-blue-600 text-white rounded-lg
                  hover:bg-blue-700 disabled:opacity-50
                  transition-colors
                "
                title={
                  isSimpleMode
                    ? '作業スペースを準備します'
                    : 'Gitブランチを作成して作業を開始します'
                }
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>
                  <span className="font-medium">{getActionLabel('start', isSimpleMode)}</span>
                  {!isSimpleMode && (
                    <span className="block text-xs text-blue-200">ブランチを作成</span>
                  )}
                </span>
              </button>
            )}

            {canGenerateProposal && onGenerateProposal && (
              <button
                onClick={onGenerateProposal}
                disabled={isLoading}
                className="
                  flex items-center gap-2 px-4 py-2
                  bg-purple-600 text-white rounded-lg
                  hover:bg-purple-700 disabled:opacity-50
                  transition-colors
                "
                title="AIがフロー定義の改善案を自動生成します"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>
                  <span className="font-medium">
                    {getActionLabel('generateProposal', isSimpleMode)}
                  </span>
                  {!isSimpleMode && (
                    <span className="block text-xs text-purple-200">LLMが変更を提案</span>
                  )}
                  {isSimpleMode && (
                    <span className="block text-xs text-purple-200">AIが改善案を作成</span>
                  )}
                </span>
              </button>
            )}

            {canMergeOrReject && (
              <>
                {onMergeClose && (
                  <button
                    onClick={onMergeClose}
                    disabled={isLoading}
                    className="
                      flex items-center gap-2 px-4 py-2
                      bg-green-600 text-white rounded-lg
                      hover:bg-green-700 disabled:opacity-50
                      transition-colors
                    "
                    title={
                      isSimpleMode
                        ? '改善内容を確定します'
                        : '変更をメインブランチに統合して効果確認フェーズへ進みます'
                    }
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>
                      <span className="font-medium">
                        {getActionLabel('mergeClose', isSimpleMode)}
                      </span>
                      {!isSimpleMode && (
                        <span className="block text-xs text-green-200">ブランチをメインに統合</span>
                      )}
                    </span>
                  </button>
                )}
                {onReject && (
                  <button
                    onClick={onReject}
                    disabled={isLoading}
                    className="
                      flex items-center gap-2 px-4 py-2
                      bg-gray-600 text-white rounded-lg
                      hover:bg-gray-700 disabled:opacity-50
                      transition-colors
                    "
                    title="この提案を却下します"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {getActionLabel('reject', isSimpleMode)}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Guided Workflow (シンプルモード時のみ) */}
      {isSimpleMode && (
        <GuidedWorkflow
          currentStatus={issue.status}
          hasProposals={!!issue.proposals && issue.proposals.length > 0}
          hasAppliedProposal={!!issue.proposals?.some(p => p.isApplied)}
          isStandardized={!!issue.standardizedAt}
          className="mb-4"
        />
      )}

      {/* Status Lifecycle */}
      <StatusLifecycle
        currentStatus={issue.status}
        checkResult={issue.checkResult}
        className="mb-6"
      />

      {/* Meta Info */}
      <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-600 dark:text-gray-400">
        {issue.targetFlowId && (
          <span className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            <span>
              対象フロー: <span className="font-medium">{issue.targetFlowId}</span>
            </span>
            {issue.targetNodeId && (
              <span className="text-gray-400 dark:text-gray-500"> &gt; {issue.targetNodeId}</span>
            )}
          </span>
        )}

        {issue.branchName && !isSimpleMode && (
          <span className="flex items-center gap-1.5">
            <GitBranch className="w-4 h-4" />
            <span className="font-mono">{issue.branchName}</span>
            <HelpTooltip content="この改善カードの変更はこのGitブランチで管理されています" />
          </span>
        )}

        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          作成: {formatDate(issue.createdAt)}
        </span>

        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          更新: {formatDate(issue.updatedAt)}
        </span>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-4" aria-label="Tabs">
          {(['details', 'proposals', 'check', 'history'] as const).map(tab => {
            const tabLabels = ISSUE_TAB_LABELS;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
                  ${isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}
                `}
              >
                {tab === 'history' && <History className="w-4 h-4" />}
                {tab === 'check' && <Search className="w-4 h-4" />}
                {tabLabels[tab]}
                {tab === 'proposals' && issue.proposals && issue.proposals.length > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}
                  >
                    {issue.proposals.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          <div className="prose prose-gray max-w-none">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">説明</h3>
            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {issue.description}
            </p>
          </div>

          {/* Plan フィールド */}
          {(issue.currentSituation ||
            issue.frequency ||
            issue.impact ||
            issue.expectedState ||
            issue.hypothesisCause ||
            issue.successMetric ||
            issue.checkDueDate) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 p-5">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-4 flex items-center gap-2">
                📋 Plan フェーズの記録
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {issue.currentSituation && (
                  <div>
                    <dt className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                      現状の困りごと
                    </dt>
                    <dd className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {issue.currentSituation}
                    </dd>
                  </div>
                )}
                {issue.frequency && (
                  <div>
                    <dt className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                      発生頻度
                    </dt>
                    <dd className="text-sm text-gray-800 dark:text-gray-200">
                      {FREQUENCY_LABELS[issue.frequency] ?? issue.frequency}
                    </dd>
                  </div>
                )}
                {issue.impact && (
                  <div>
                    <dt className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                      影響
                    </dt>
                    <dd className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {issue.impact}
                    </dd>
                  </div>
                )}
                {issue.expectedState && (
                  <div>
                    <dt className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                      期待する状態
                    </dt>
                    <dd className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {issue.expectedState}
                    </dd>
                  </div>
                )}
                {issue.hypothesisCause && (
                  <div>
                    <dt className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                      原因の仮説
                    </dt>
                    <dd className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {issue.hypothesisCause}
                    </dd>
                  </div>
                )}
                {issue.successMetric && (
                  <div>
                    <dt className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                      効果を測る指標
                    </dt>
                    <dd className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {issue.successMetric}
                    </dd>
                  </div>
                )}
                {issue.checkDueDate && (
                  <div>
                    <dt className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                      効果確認の予定日
                    </dt>
                    <dd className="text-sm text-gray-800 dark:text-gray-200">
                      {formatDate(issue.checkDueDate)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      )}

      {activeTab === 'proposals' && (
        <div className="space-y-4">
          {issue.proposals && issue.proposals.length > 0 ? (
            issue.proposals.map(proposal => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onApply={onApplyProposal ? () => onApplyProposal(proposal.id) : undefined}
              />
            ))
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="font-medium">まだ改善案がありません</p>
              {canGenerateProposal && onGenerateProposal ? (
                <div className="mt-3">
                  <p className="text-sm text-gray-400 dark:text-gray-500 mb-2">
                    AIがフロー定義を分析し、この改善カードに対する改善案を自動生成します
                  </p>
                  <button
                    onClick={onGenerateProposal}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    {getActionLabel('generateProposal', isSimpleMode)}
                  </button>

                  <div className="flex items-center gap-3 my-6 max-w-md mx-auto">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs text-gray-400 dark:text-gray-500">または</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>

                  <div className="max-w-2xl mx-auto">
                    <ManualProposalWizard issueId={issue.id} />
                  </div>
                </div>
              ) : issue.status === 'new' || issue.status === 'triage' ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  まず「{getActionLabel('start', isSimpleMode)}」を押してから、改善案を生成できます
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      {activeTab === 'check' && (
        <div className="space-y-6">
          {issue.status !== 'merged' && !issue.standardizedAt && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
              効果確認は、改善をフローに反映してから行います。
            </div>
          )}

          {issue.standardizedAt && (
            <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg px-4 py-3">
              <Star className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  完了（標準化済み）
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  {formatDate(issue.standardizedAt)}
                </p>
              </div>
            </div>
          )}

          {/* Check フォーム。必須は「どうだったか」の1問だけで、残りは任意 */}
          <div className="space-y-4">
            <fieldset>
              <legend className="text-base font-bold text-gray-900 dark:text-gray-100">
                やってみて、どうでしたか？
              </legend>
              <p className="mt-1 mb-3 text-sm text-gray-500 dark:text-gray-400">
                答えるのはこの1問だけで大丈夫です。詳しい記録は下の「くわしく記録する」に任意で書けます。
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                {(['effective', 'ineffective', 'pending'] as const).map(result => {
                  const cfg = CHECK_RESULT_LABELS[result];
                  const isSelected = checkForm.checkResult === result;
                  return (
                    <label
                      key={result}
                      className={`
                        flex flex-1 cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors
                        ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                            : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/50'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="checkResult"
                        value={result}
                        checked={isSelected}
                        onChange={e => setCheckForm(f => ({ ...f, checkResult: e.target.value }))}
                        className="mt-0.5 text-blue-600"
                      />
                      <span className="min-w-0">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                        <span className="mt-1 block text-xs text-gray-600 dark:text-gray-400">
                          {cfg.hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <details
              open={isCheckDetailsOpen}
              onToggle={e => setIsCheckDetailsOpen(e.currentTarget.open)}
              className="rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                くわしく記録する（任意）
              </summary>
              <div className="space-y-4 border-t border-gray-200 px-4 py-4 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      改善前の数値・状態
                    </label>
                    <textarea
                      rows={3}
                      value={checkForm.metricBefore}
                      onChange={e => setCheckForm(f => ({ ...f, metricBefore: e.target.value }))}
                      placeholder="例: 手作業で月3時間かかっていた"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      改善後の数値・状態
                    </label>
                    <textarea
                      rows={3}
                      value={checkForm.metricAfter}
                      onChange={e => setCheckForm(f => ({ ...f, metricAfter: e.target.value }))}
                      placeholder="例: 自動化で30分に削減"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    確認日
                  </label>
                  <input
                    type="date"
                    value={checkForm.checkDate}
                    onChange={e => setCheckForm(f => ({ ...f, checkDate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:w-1/2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    学び
                  </label>
                  <textarea
                    rows={3}
                    value={checkForm.learning}
                    onChange={e => setCheckForm(f => ({ ...f, learning: e.target.value }))}
                    placeholder="この改善から得られた気づきや学び"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    次のアクション
                  </label>
                  <textarea
                    rows={2}
                    value={checkForm.nextAction}
                    onChange={e => setCheckForm(f => ({ ...f, nextAction: e.target.value }))}
                    placeholder="次に取り組む改善や展開すること"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </details>

            {!canWrite && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                あなたの権限は閲覧のみです。記録の保存や完了の操作はできません。
              </p>
            )}

            <div className={`flex items-center gap-3 ${canWrite ? '' : 'hidden'}`}>
              <button
                onClick={() => void saveCheck()}
                disabled={checkSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {checkSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {getActionLabel('saveCheck', isSimpleMode)}
              </button>
              {checkSaved && (
                <span className="text-sm text-green-600 font-medium">保存しました</span>
              )}
              {checkSaveError && (
                <span className="text-sm text-red-600 font-medium">
                  保存に失敗しました。もう一度お試しください
                </span>
              )}

              {canCloseFromCheck && checkForm.checkResult === 'effective' && (
                <button
                  onClick={handleStandardize}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  <Star className="w-4 h-4" />
                  {getActionLabel('standardize', isSimpleMode)}
                </button>
              )}
            </div>

            {/* 効果なし: 見送りとして閉じる / やり直す */}
            {canCloseFromCheck && checkForm.checkResult === 'ineffective' && (
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  効果が出なかった改善も、記録して閉じることで次に活かせます。ボタンを押すと、この画面の記録を保存してから見送りとして完了します。
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {onCloseIneffective && (
                    <button
                      onClick={() => void handleSaveAndCloseIneffective()}
                      disabled={isLoading || checkSaving}
                      title="効果確認の記録を保存してから、見送りとして完了します"
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm font-medium"
                    >
                      <XCircle className="w-4 h-4" />
                      {getActionLabel('closeAsRejected', isSimpleMode)}
                    </button>
                  )}
                  <Link
                    href="/issues/new"
                    className="flex items-center gap-2 px-4 py-2 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {getActionLabel('retryImprovement', isSimpleMode)}
                  </Link>
                </div>
              </div>
            )}

            {/* 判断保留: 次の確認予定日を決めて後で戻ってくる */}
            {canCloseFromCheck && checkForm.checkResult === 'pending' && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 space-y-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  まだ判断できない場合は、次に確認する日を決めておきましょう。予定日になったら「
                  {ISSUE_TAB_LABELS.check}」タブに戻って結果を記録してください。
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      次の確認予定日
                    </label>
                    <input
                      type="date"
                      value={checkForm.checkDueDate}
                      onChange={e => setCheckForm(f => ({ ...f, checkDueDate: e.target.value }))}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={() => void saveCheck()}
                    disabled={checkSaving || !checkForm.checkDueDate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
                  >
                    {checkSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CalendarClock className="w-4 h-4" />
                    )}
                    {getActionLabel('updateCheckDueDate', isSimpleMode)}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          {auditLoading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin text-gray-400 dark:text-gray-500" />
              <p>履歴を読み込み中...</p>
            </div>
          ) : auditError ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <History className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p>履歴の読み込みに失敗しました</p>
              <button
                onClick={() => void fetchAuditLogs()}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                再試行
              </button>
            </div>
          ) : auditLogs.length > 0 ? (
            <div className="space-y-3">
              {auditLogs.map(log => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <div className="mt-0.5">
                    <History className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {AUDIT_ACTION_LABELS[log.action] || log.action}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatDate(log.createdAt)}
                      {log.actor && ` — ${log.actor}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <History className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p>まだ操作履歴がありません</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
