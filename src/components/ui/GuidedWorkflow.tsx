/**
 * FlowOps - Guided Workflow Component
 *
 * シンプルモード時にIssue詳細ページに表示する
 * 「今何をすればいいか」ガイドパネル。
 * 現在のステップに応じた具体的なアクション指示を提供する。
 */

'use client';

import React from 'react';
import { AlertCircle, Play, Sparkles, Eye, CheckCircle, Lightbulb } from 'lucide-react';
import { IssueStatus } from '@/core/issue';

interface GuidedWorkflowProps {
  currentStatus: IssueStatus;
  hasProposals: boolean;
  hasAppliedProposal: boolean;
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
  hasAppliedProposal: boolean
): GuideStep | null {
  switch (status) {
    case 'new':
    case 'triage':
      return {
        icon: Play,
        iconColor: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        title: 'まず「改善を始める」を押してください',
        description: '安全な作業スペースが自動的に準備されます。元のフローには影響しません。',
        actionHint: '上部の青いボタンを押してください',
      };
    case 'in-progress':
      if (hasProposals) {
        return {
          icon: Eye,
          iconColor: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          title: '改善案を確認してください',
          description:
            '「改善案」タブを開いて、AIが提案した内容を確認し「反映する」を押してください。',
        };
      }
      return {
        icon: Sparkles,
        iconColor: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        title: '「AIで改善案を生成」を押してください',
        description: 'AIが課題の内容とフローを分析して、具体的な改善案を自動作成します。',
        actionHint: '上部の紫色のボタンを押してください',
      };
    case 'proposed':
      if (!hasAppliedProposal) {
        return {
          icon: Eye,
          iconColor: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          title: '改善案を確認して反映してください',
          description: '「改善案」タブを開いて内容を確認し、「反映する」ボタンを押してください。',
        };
      }
      return {
        icon: CheckCircle,
        iconColor: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        title: '「変更を確定する」で完了できます',
        description:
          '改善案が反映されています。問題なければ「変更を確定する」を押して完了してください。',
        actionHint: '上部の緑色のボタンを押してください',
      };
    case 'merged':
      return {
        icon: CheckCircle,
        iconColor: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
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
  className = '',
}: GuidedWorkflowProps) {
  const guide = getGuideForStatus(currentStatus, hasProposals, hasAppliedProposal);
  if (!guide) return null;

  const Icon = guide.icon;

  return (
    <div className={`rounded-xl border ${guide.borderColor} ${guide.bgColor} p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${guide.bgColor}`}>
          <Icon className={`w-5 h-5 ${guide.iconColor}`} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900 mb-1">{guide.title}</h3>
          <p className="text-sm text-gray-600">{guide.description}</p>
          {guide.actionHint && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
              <Lightbulb className="w-3.5 h-3.5" />
              {guide.actionHint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
