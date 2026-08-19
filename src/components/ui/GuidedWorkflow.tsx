/**
 * FlowOps - Guided Workflow Component
 *
 * 改善カード詳細ページに表示する
 * 「今何をすればいいか」ガイドパネル。
 * 現在のステップに応じた具体的なアクション指示を提供する。
 */

'use client';

import React from 'react';
import { Play, Sparkles, Eye, CheckCircle, Search, Star, type LucideIcon } from 'lucide-react';
import { IssueStatus } from '@/core/issue';
import { useDisplayMode } from '@/lib/simple-mode-context';
import { getActionLabel, ISSUE_TAB_LABELS } from '@/lib/ui-labels';
import { NextStepCard } from './NextStepCard';

interface GuidedWorkflowProps {
  currentStatus: IssueStatus;
  hasProposals: boolean;
  hasAppliedProposal: boolean;
  /** Act フェーズ（標準化）まで完了しているか */
  isStandardized?: boolean;
  className?: string;
}

interface GuideStep {
  icon: LucideIcon;
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
        title: `まず「${getActionLabel('start', isSimpleMode)}」を押してください`,
        description: '安全な作業スペースが自動的に準備されます。元のフローには影響しません。',
        actionHint: `画面上部の「${getActionLabel('start', isSimpleMode)}」ボタンを押してください`,
      };
    case 'in-progress':
      if (hasProposals) {
        return {
          icon: Eye,
          title: '改善案を確認してください',
          description: `「${ISSUE_TAB_LABELS.proposals}」タブを開いて、AIが提案した内容を確認し「${getActionLabel('applyProposal', isSimpleMode)}」を押してください。`,
        };
      }
      return {
        icon: Sparkles,
        title: `「${getActionLabel('generateProposal', isSimpleMode)}」を押してください`,
        description: 'AIが改善カードの内容とフローを分析して、具体的な改善案を自動作成します。',
        actionHint: `画面上部の「${getActionLabel('generateProposal', isSimpleMode)}」ボタンを押してください`,
      };
    case 'proposed':
      if (!hasAppliedProposal) {
        return {
          icon: Eye,
          title: '改善案を確認して反映してください',
          description: `「${ISSUE_TAB_LABELS.proposals}」タブを開いて内容を確認し、「${getActionLabel('applyProposal', isSimpleMode)}」ボタンを押してください。`,
        };
      }
      return {
        icon: CheckCircle,
        title: `「${getActionLabel('mergeClose', isSimpleMode)}」に進めます`,
        description: `改善案が反映されています。問題なければ「${getActionLabel('mergeClose', isSimpleMode)}」を押してください。`,
        actionHint: `画面上部の「${getActionLabel('mergeClose', isSimpleMode)}」ボタンを押してください`,
      };
    case 'merged':
      if (isStandardized) {
        return {
          icon: Star,
          title: 'この改善は標準化されて完了しました。お疲れ様でした！',
          description: isSimpleMode
            ? '新しいやり方が定着しました。ほかに気になることがあれば、また改善カードを作りましょう。'
            : '効果が確認され、Act フェーズ（標準化）まで完了しています。この改善カードで行うことはありません。',
        };
      }
      return {
        icon: Search,
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

  return (
    <NextStepCard
      icon={guide.icon}
      title={guide.title}
      description={guide.description}
      hint={guide.actionHint}
      dismissKey="issue-detail"
      className={className}
    />
  );
}
