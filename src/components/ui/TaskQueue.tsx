/**
 * FlowOps - Task Queue Component
 *
 * ダッシュボードに表示する「やることリスト」。
 * 現在の改善カードの状況に応じて、次にやるべきアクションを
 * 優先度順に表示する。
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { Eye, FileEdit, Plus, ListChecks } from 'lucide-react';

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

  // 優先度1: 改善案を確認する（proposed状態）
  const proposedIssues = recentIssues.filter(i => i.status === 'proposed');
  proposedIssues.forEach(issue => {
    actions.push({
      priority: 1,
      icon: Eye,
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
      label: '改善案を確認する',
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
      icon: FileEdit,
      iconColor: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/30',
      label: '改善案の作成へ進む',
      description: `${issue.humanId}: ${issue.title}`,
      href: `/issues/${issue.id}`,
      actionLabel: '開く',
    });
  });

  // 優先度3: 新しい改善カードを作る（アクティブな改善カードが少ない場合）
  if (stats.open === 0 && stats.inProgress === 0 && stats.proposed === 0) {
    actions.push({
      priority: 3,
      icon: Plus,
      iconColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/30',
      label: '改善カードを作る',
      description: '業務フローの困りごとを記録して、改善を始めましょう',
      href: '/issues/new',
      actionLabel: '作る',
    });
  }

  if (actions.length === 0) return null;

  return (
    <div className="fo-panel fo-queue overflow-hidden">
      <div className="fo-panel-heading">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">やることリスト</h2>
          <span className="ml-auto text-xs font-medium tabular-nums">{actions.length}件</span>
        </div>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-gray-700">
        {actions.slice(0, 5).map((action, i) => {
          const Icon = action.icon;
          return (
            <div key={i} className="px-4 sm:px-6 py-3 flex items-center gap-3">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${action.bgColor}`}
              >
                <Icon className={`w-5 h-5 ${action.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {action.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {action.description}
                </p>
              </div>
              <Link href={action.href} className="fo-action">
                {action.actionLabel}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
