/**
 * FlowOps - Task Queue Component
 *
 * ダッシュボードに表示する「やることリスト」。
 * 現在のIssue状況に応じて、次にやるべきアクションを
 * 優先度順に表示する。
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { Eye, Sparkles, Plus, ArrowRight, ListChecks } from 'lucide-react';

interface TaskQueueItem {
  id: string;
  humanId: string;
  title: string;
  status: string;
}

interface TaskQueueProps {
  recentIssues: TaskQueueItem[];
  stats: {
    open: number;
    inProgress: number;
    proposed: number;
  };
}

interface TaskAction {
  priority: number;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  label: string;
  description: string;
  href: string;
  actionLabel: string;
}

export function TaskQueue({ recentIssues, stats }: TaskQueueProps) {
  const actions: TaskAction[] = [];

  // 優先度1: 改善案を確認してください（proposed状態）
  const proposedIssues = recentIssues.filter(i => i.status === 'proposed');
  proposedIssues.forEach(issue => {
    actions.push({
      priority: 1,
      icon: Eye,
      iconColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      label: '改善案を確認してください',
      description: `${issue.humanId}: ${issue.title}`,
      href: `/issues/${issue.id}`,
      actionLabel: '確認する',
    });
  });

  // 優先度2: AIに改善案を依頼（in-progress状態）
  const inProgressIssues = recentIssues.filter(i => i.status === 'in-progress');
  inProgressIssues.forEach(issue => {
    actions.push({
      priority: 2,
      icon: Sparkles,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      label: 'AIに改善案を依頼しましょう',
      description: `${issue.humanId}: ${issue.title}`,
      href: `/issues/${issue.id}`,
      actionLabel: '開く',
    });
  });

  // 優先度3: 新しい課題を報告（アクティブな課題が少ない場合）
  if (stats.open === 0 && stats.inProgress === 0 && stats.proposed === 0) {
    actions.push({
      priority: 3,
      icon: Plus,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      label: '新しい課題を報告しましょう',
      description: '改善したい業務フローの課題を報告して、改善を始めましょう',
      href: '/issues/new',
      actionLabel: '報告する',
    });
  }

  if (actions.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-gray-900">やることリスト</h2>
          <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            {actions.length}件
          </span>
        </div>
      </div>
      <div className="divide-y divide-gray-50">
        {actions.slice(0, 5).map((action, i) => {
          const Icon = action.icon;
          return (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${action.bgColor}`}
              >
                <Icon className={`w-5 h-5 ${action.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{action.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{action.description}</p>
              </div>
              <Link
                href={action.href}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg font-medium transition-colors"
              >
                {action.actionLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
