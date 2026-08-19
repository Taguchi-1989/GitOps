/**
 * FlowOps - Guided Workflow Component
 *
 * 改善カード詳細ページに表示する
 * 「今何をすればいいか」ガイドパネル。
 * 現在のステップに応じた具体的なアクション指示を提供する。
 */

'use client';

import React from 'react';
import { Play, Sparkles, Eye, CheckCircle, Lightbulb, Search, Star } from 'lucide-react';
import { IssueStatus } from '@/core/issue';
import { useDisplayMode } from '@/lib/simple-mode-context';
import { getActionLabel, ISSUE_TAB_LABELS } from '@/lib/ui-labels';

interface GuidedWorkflowProps {
  currentStatus: IssueStatus;
  hasProposals: boolean;
  hasAppliedProposal: boolean;
  /** Act フェーズ（標準化）まで完了しているか */
  isStandardized?: boolean;
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
}

function getGuideForStatus(
  status: IssueStatus,
  hasProposals: boolean,
  hasAppliedProposal: boolean,
  isSimpleMode: boolean,
  isStandardized: boolean
): GuideStep | null {
  switch (status) {
    case 'new':
    case 'triage':
      return {
        icon: Play,
        iconColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/30',
        borderColor: 'border-blue-200 dark:border-blue-800',
        title: `まず「${getActionLabel('start', isSimpleMode)}」を押してください`,
        description: '安全な作業スペースが自動的に準備されます。元のフローには影響しません。',
        actionHint: `画面上部の「${getActionLabel('start', isSimpleMode)}」ボタンを押してください`,
      };
    case 'in-progress':
      if (hasProposals) {
        return {
          icon: Eye,
          iconColor: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-50 dark:bg-purple-900/30',
          borderColor: 'border-purple-200 dark:border-purple-800',
          title: '改善案を確認してください',
          description: `「${ISSUE_TAB_LABELS.proposals}」タブを開いて、AIが提案した内容を確認し「${getActionLabel('applyProposal', isSimpleMode)}」を押してください。`,
        };
      }
      return {
        icon: Sparkles,
        iconColor: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/30',
        borderColor: 'border-purple-200 dark:border-purple-800',
        title: `「${getActionLabel('generateProposal', isSimpleMode)}」を押してください`,
        description: 'AIが改善カードの内容とフローを分析して、具体的な改善案を自動作成します。',
        actionHint: `画面上部の「${getActionLabel('generateProposal', isSimpleMode)}」ボタンを押してください`,
      };
    case 'proposed':
      if (!hasAppliedProposal) {
        return {
          icon: Eye,
          iconColor: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          title: '改善案を確認して反映してください',
          description: `「${ISSUE_TAB_LABELS.proposals}」タブを開いて内容を確認し、「${getActionLabel('applyProposal', isSimpleMode)}」ボタンを押してください。`,
        };
      }
      return {
        icon: CheckCircle,
        iconColor: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/30',
        borderColor: 'border-green-200 dark:border-green-800',
        title: `「${getActionLabel('mergeClose', isSimpleMode)}」に進めます`,
        description: `改善案が反映されています。問題なければ「${getActionLabel('mergeClose', isSimpleMode)}」を押してください。`,
        actionHint: `画面上部の「${getActionLabel('mergeClose', isSimpleMode)}」ボタンを押してください`,
      };
    case 'merged':
      if (isStandardized) {
        return {
          icon: Star,
          iconColor: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-50 dark:bg-purple-900/30',
          borderColor: 'border-purple-200 dark:border-purple-800',
          title: 'この改善は標準化されて完了しました。お疲れ様でした！',
          description: isSimpleMode
            ? '新しいやり方が定着しました。ほかに気になることがあれば、また改善カードを作りましょう。'
            : '効果が確認され、Act フェーズ（標準化）まで完了しています。この改善カードで行うことはありません。',
        };
      }
      return {
        icon: Search,
        iconColor: 'text-teal-600 dark:text-teal-400',
        bgColor: 'bg-teal-50 dark:bg-teal-900/30',
        borderColor: 'border-teal-200 dark:border-teal-800',
        title: 'フローに反映されました。次は効果を確認しましょう',
        description: `「${ISSUE_TAB_LABELS.check}」タブで改善前後の状態を記録し、「${getActionLabel('saveCheck', isSimpleMode)}」を押してください。効果ありなら「${getActionLabel('standardize', isSimpleMode)}」で完了です。`,
      };
    default:
      return null;
  }
}

export function GuidedWorkflow({
  currentStatus,
  hasProposals,
  hasAppliedProposal,
  isStandardized = false,
  className = '',
}: GuidedWorkflowProps) {
  const { isSimpleMode } = useDisplayMode();
  const guide = getGuideForStatus(
    currentStatus,
    hasProposals,
    hasAppliedProposal,
    isSimpleMode,
    isStandardized
  );
  if (!guide) return null;

  const Icon = guide.icon;

  return (
    <div className={`rounded-xl border ${guide.borderColor} ${guide.bgColor} p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${guide.bgColor}`}>
          <Icon className={`w-5 h-5 ${guide.iconColor}`} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{guide.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{guide.description}</p>
          {guide.actionHint && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <Lightbulb className="w-3.5 h-3.5" />
              {guide.actionHint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
