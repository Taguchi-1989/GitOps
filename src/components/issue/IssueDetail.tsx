/**
 * FlowOps - Issue Detail Component
 *
 * Issue詳細画面のメインコンポーネント
 * - ステータスライフサイクルの可視化
 * - 日本語のアクションボタン
 * - コンテキストヘルプ
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from './StatusBadge';
import { StatusLifecycle } from './StatusLifecycle';
import { IssueCardData } from './IssueCard';
import { ProposalCard, ProposalData } from './ProposalCard';
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
} from 'lucide-react';
import { useSimpleMode } from '@/lib/simple-mode-context';
import { GuidedWorkflow } from '@/components/ui/GuidedWorkflow';

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
  onReturnToProgress?: () => void;
  isLoading?: boolean;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  ISSUE_CREATE: '課題を作成',
  ISSUE_UPDATE: '課題を更新',
  ISSUE_START: '作業を開始',
  ISSUE_CLOSE: '課題を完了',
  ISSUE_DELETE: '課題を削除',
  PRAISE_CREATE: '感謝を送る',
  PROPOSAL_GENERATE: '改善案を生成',
  PATCH_APPLY: '改善案を適用',
  MERGE_CLOSE: 'マージして完了',
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
  traceId?: string | null;
  payload?: string | Record<string, unknown> | null;
  createdAt: string;
}

function parsePayload(p: AuditLogItem['payload']): Record<string, unknown> | null {
  if (!p) return null;
  if (typeof p === 'string') {
    try {
      return JSON.parse(p);
    } catch {
      return { raw: p };
    }
  }
  return p;
}

function HistoryTimeline({
  logs,
  loading,
  issueId,
}: {
  logs: AuditLogItem[];
  loading: boolean;
  issueId: string;
}) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="text-center py-12 text-gray-700 dark:text-gray-300"
      >
        <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin" aria-hidden="true" />
        <p>履歴を読み込み中...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-700 dark:text-gray-300">
        <History
          className="w-8 h-8 mx-auto mb-3 text-gray-400 dark:text-gray-500"
          aria-hidden="true"
        />
        <p>まだ操作履歴がありません</p>
      </div>
    );
  }

  return (
    <div>
      <ol className="relative space-y-4 border-l-2 border-gray-200 dark:border-gray-700 pl-6 ml-2">
        {logs.map(log => {
          const payload = parsePayload(log.payload);
          const isExpanded = expandedIds.has(log.id);
          return (
            <li key={log.id} className="relative">
              <span
                className="absolute -left-[33px] top-1 w-4 h-4 bg-blue-600 dark:bg-blue-500 border-2 border-white dark:border-gray-800 rounded-full"
                aria-hidden="true"
              />
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {AUDIT_ACTION_LABELS[log.action] || log.action}
                  </p>
                  <time
                    dateTime={log.createdAt}
                    className="text-xs text-gray-700 dark:text-gray-300"
                  >
                    {formatDate(log.createdAt)}
                  </time>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-700 dark:text-gray-300 flex-wrap">
                  {log.actor && <span>実行者: {log.actor}</span>}
                  {log.traceId && (
                    <a
                      href={`/governance/trace/${log.traceId}`}
                      className="font-mono text-blue-700 dark:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                    >
                      trace: {log.traceId.slice(0, 8)}...
                    </a>
                  )}
                </div>
                {payload && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => toggle(log.id)}
                      aria-expanded={isExpanded}
                      className="text-xs text-blue-700 dark:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                    >
                      {isExpanded ? '詳細を閉じる' : '詳細を表示'}
                    </button>
                    {isExpanded && (
                      <pre className="mt-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                        {JSON.stringify(payload, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 text-right">
        <a
          href={`/audit?entityType=Issue&entityId=${issueId}`}
          className="text-xs text-blue-700 dark:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          監査ログでこの課題を全件表示 →
        </a>
      </div>
    </div>
  );
}

export function IssueDetail({
  issue,
  onBack,
  onStart,
  onGenerateProposal,
  onApplyProposal,
  onMergeClose,
  onReject,
  onReturnToProgress,
  isLoading = false,
}: IssueDetailProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'proposals' | 'history'>('details');
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const { isSimpleMode } = useSimpleMode();

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/audit?entityType=Issue&entityId=${issue.id}&limit=50`);
      const data = await res.json();
      if (data.ok && data.data?.logs) {
        setAuditLogs(data.data.logs);
      }
    } catch {
      // fail silently
    } finally {
      setAuditLoading(false);
    }
  }, [issue.id]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);
  const isPraise = issue.kind === 'praise';
  const canStart = !isPraise && (issue.status === 'new' || issue.status === 'triage');
  const canGenerateProposal = !isPraise && issue.status === 'in-progress';
  const canMergeOrReject = !isPraise && issue.status === 'proposed';

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
            課題一覧に戻る
          </button>
        )}

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-lg font-mono text-gray-700 dark:text-gray-300">
                {issue.humanId}
              </span>
              {isPraise ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200">
                  感謝・成功事例
                </span>
              ) : (
                <StatusBadge status={issue.status} />
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 break-words">
              {issue.title}
            </h1>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 lg:flex-shrink-0">
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
                  <span className="font-medium">
                    {isSimpleMode ? '改善を始める' : '作業を開始'}
                  </span>
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
                  <span className="font-medium">AIで改善案を生成</span>
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
                        : '変更をメインブランチに統合してIssueを完了にします'
                    }
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>
                      <span className="font-medium">
                        {isSimpleMode ? '変更を確定する' : 'マージして完了'}
                      </span>
                      {!isSimpleMode && (
                        <span className="block text-xs text-green-200">メインに統合</span>
                      )}
                    </span>
                  </button>
                )}
                {onReturnToProgress && (
                  <button
                    type="button"
                    onClick={onReturnToProgress}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 min-h-11 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400"
                    title="提案者に練り直しを依頼します"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    差戻し
                  </button>
                )}
                {onReject && (
                  <button
                    type="button"
                    onClick={onReject}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 min-h-11 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400"
                    title="この提案を却下します"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <XCircle className="w-4 h-4" aria-hidden="true" />
                    )}
                    却下
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 次にすべきことガイド (全ユーザーに常時表示。現場の人が迷子にならないため) */}
      {!isPraise && (
        <GuidedWorkflow
          currentStatus={issue.status}
          hasProposals={!!issue.proposals && issue.proposals.length > 0}
          hasAppliedProposal={!!issue.proposals?.some(p => p.isApplied)}
          hasTargetFlow={!!issue.targetFlowId}
          className="mb-4"
        />
      )}

      {/* Status Lifecycle */}
      <StatusLifecycle currentStatus={issue.status} className="mb-6" />

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
            <HelpTooltip content="このIssueの変更はこのGitブランチで管理されています" />
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
          <button
            onClick={() => setActiveTab('details')}
            className={`
              px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
          >
            詳細
          </button>
          {!isPraise && (
            <button
              onClick={() => setActiveTab('proposals')}
              className={`
              flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${
                activeTab === 'proposals'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
            >
              改善案
              {issue.proposals && issue.proposals.length > 0 && (
                <span
                  className={`
                px-2 py-0.5 rounded-full text-xs
                ${activeTab === 'proposals' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}
              `}
                >
                  {issue.proposals.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab('history')}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
          >
            <History className="w-4 h-4" />
            履歴
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="prose prose-gray max-w-none">
          <h3>説明</h3>
          <p className="whitespace-pre-wrap">{issue.description}</p>
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
                    AIがフロー定義を分析し、この課題に対する改善案を自動生成します
                  </p>
                  <button
                    onClick={onGenerateProposal}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    AIで改善案を生成
                  </button>
                </div>
              ) : issue.status === 'new' || issue.status === 'triage' ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  まず「作業を開始」を押してから、改善案を生成できます
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <HistoryTimeline logs={auditLogs} loading={auditLoading} issueId={issue.id} />
      )}
    </div>
  );
}
