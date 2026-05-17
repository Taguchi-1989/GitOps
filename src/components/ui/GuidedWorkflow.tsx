/**
 * FlowOps - Guided Workflow Component
 *
 * シンプルモード時にIssue詳細ページに表示する
 * 「今何をすればいいか」ガイドパネル。
 * 現在のステップに応じた具体的なアクション指示を提供する。
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, Play, Sparkles, Eye, CheckCircle, Lightbulb } from 'lucide-react';
import { IssueStatus } from '@/core/issue';

interface GuidedWorkflowProps {
  currentStatus: IssueStatus;
  hasProposals: boolean;
  hasAppliedProposal: boolean;
  hasTargetFlow?: boolean;
  className?: string;
}

interface GuideStep {
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  title: string;
  description: string;
  actionHint?: string;
  actionLink?: { label: string; href: string };
}

function getGuideForStatus(
  status: IssueStatus,
  hasProposals: boolean,
  hasAppliedProposal: boolean,
  hasTargetFlow: boolean
): GuideStep | null {
  switch (status) {
    case 'new':
    case 'triage':
      return {
        icon: Play,
        iconColor: 'text-blue-700 dark:text-blue-300',
        bgColor: 'bg-blue-50 dark:bg-blue-900/30',
        borderColor: 'border-blue-200 dark:border-blue-800',
        title: 'まず「作業を開始」を押してください',
        description: '安全な作業スペースが自動的に準備されます。元のフローには影響しません。',
        actionHint: '上部の青いボタンを押してください',
      };
    case 'in-progress':
      if (hasProposals) {
        return {
          icon: Eye,
          iconColor: 'text-purple-700 dark:text-purple-300',
          bgColor: 'bg-purple-50 dark:bg-purple-900/30',
          borderColor: 'border-purple-200 dark:border-purple-800',
          title: '改善案を確認してください',
          description:
            '「改善案」タブを開いて、AIが提案した内容を確認し「反映する」を押してください。',
        };
      }
      if (!hasTargetFlow) {
        return {
          icon: AlertCircle,
          iconColor: 'text-orange-700 dark:text-orange-300',
          bgColor: 'bg-orange-50 dark:bg-orange-900/30',
          borderColor: 'border-orange-200 dark:border-orange-800',
          title: '対象フローを設定してください',
          description:
            'AIが改善案を作るには「どのフローを改善するか」が必要です。対象フローを指定して課題を作り直してください。',
          actionLink: { label: '対象フローを指定して新しい課題を作成', href: '/issues/new' },
        };
      }
      return {
        icon: Sparkles,
        iconColor: 'text-purple-700 dark:text-purple-300',
        bgColor: 'bg-purple-50 dark:bg-purple-900/30',
        borderColor: 'border-purple-200 dark:border-purple-800',
        title: '「AIで改善案を生成」を押してください',
        description: 'AIが課題の内容とフローを分析して、具体的な改善案を自動作成します。',
        actionHint: '上部の紫色のボタンを押してください',
      };
    case 'proposed':
      if (!hasAppliedProposal) {
        return {
          icon: Eye,
          iconColor: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          title: '改善案を確認して反映してください',
          description: '「改善案」タブを開いて内容を確認し、「反映する」ボタンを押してください。',
        };
      }
      return {
        icon: CheckCircle,
        iconColor: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/30',
        borderColor: 'border-green-200 dark:border-green-800',
        title: '「変更を確定する」で完了できます',
        description:
          '改善案が反映されています。問題なければ「変更を確定する」を押して完了してください。',
        actionHint: '上部の緑色のボタンを押してください',
      };
    case 'merged':
      return {
        icon: CheckCircle,
        iconColor: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/30',
        borderColor: 'border-green-200 dark:border-green-800',
        title: 'この課題は完了しました',
        description: '改善内容が正式にフローに反映されています。お疲れ様でした！',
      };
    default:
      return null;
  }
}

export function GuidedWorkflow({
  currentStatus,
  hasProposals,
  hasAppliedProposal,
  hasTargetFlow = true,
  className = '',
}: GuidedWorkflowProps) {
  const guide = getGuideForStatus(currentStatus, hasProposals, hasAppliedProposal, hasTargetFlow);
  if (!guide) return null;

  const Icon = guide.icon;

  return (
    <section
      role="region"
      aria-label="次にすべきこと"
      className={`rounded-xl border ${guide.borderColor} ${guide.bgColor} p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${guide.bgColor}`} aria-hidden="true">
          <Icon className={`w-5 h-5 ${guide.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{guide.title}</h3>
          <p className="text-sm text-gray-800 dark:text-gray-200">{guide.description}</p>
          {guide.actionHint && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-700 dark:text-gray-300">
              <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
              {guide.actionHint}
            </div>
          )}
          {guide.actionLink && (
            <Link
              href={guide.actionLink.href}
              className="inline-flex items-center mt-3 min-h-11 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400"
            >
              {guide.actionLink.label} →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
