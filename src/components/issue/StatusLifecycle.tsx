/**
 * FlowOps - Status Lifecycle Visualization
 *
 * Issue詳細画面でステータスの流れと現在地を可視化する
 */

'use client';

import React from 'react';
import { IssueStatus } from '@/core/issue';
import {
  ClipboardList,
  Play,
  Sparkles,
  Search,
  Star,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { useSimpleMode } from '@/lib/simple-mode-context';

interface StatusLifecycleProps {
  currentStatus: IssueStatus;
  className?: string;
}

interface LifecycleStep {
  status: IssueStatus;
  label: string;
  hint: string;
  simpleHint: string;
  icon: React.ElementType;
  color: string;
  activeColor: string;
}

const lifecycleSteps: LifecycleStep[] = [
  {
    status: 'new',
    label: 'Plan',
    hint: '課題を整理する',
    simpleHint: '困りごとを記録する',
    icon: ClipboardList,
    color: 'text-gray-300 dark:text-gray-600',
    activeColor: 'text-red-500 bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800',
  },
  {
    status: 'in-progress',
    label: 'Do',
    hint: '改善を試す',
    simpleHint: '改善に取り組む',
    icon: Play,
    color: 'text-gray-300 dark:text-gray-600',
    activeColor:
      'text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800',
  },
  {
    status: 'proposed',
    label: 'Do',
    hint: '改善案を確認する',
    simpleHint: 'AIの改善案を確認する',
    icon: Sparkles,
    color: 'text-gray-300 dark:text-gray-600',
    activeColor:
      'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800',
  },
  {
    status: 'merged',
    label: 'Check',
    hint: '効果を確認する',
    simpleHint: '改善が効いたか確認する',
    icon: Search,
    color: 'text-gray-300 dark:text-gray-600',
    activeColor:
      'text-teal-500 bg-teal-50 border-teal-200 dark:bg-teal-900/30 dark:border-teal-800',
  },
  {
    status: 'merged',
    label: 'Act',
    hint: '標準化する',
    simpleHint: 'この方法を定着させる',
    icon: Star,
    color: 'text-gray-300 dark:text-gray-600',
    activeColor:
      'text-purple-500 bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800',
  },
];

// ステータスの順序マッピング（5ステップ: Plan/Do/Do/Check/Act）
const statusOrder: Record<string, number> = {
  new: 0,
  triage: 0,
  'in-progress': 1,
  proposed: 2,
  merged: 3,
  rejected: -1,
  'merged-duplicate': -1,
};

export function StatusLifecycle({ currentStatus, className = '' }: StatusLifecycleProps) {
  const { isSimpleMode } = useSimpleMode();
  const currentOrder = statusOrder[currentStatus] ?? -1;
  const isTerminal = currentStatus === 'rejected' || currentStatus === 'merged-duplicate';

  if (isTerminal) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg border ${
              currentStatus === 'rejected'
                ? 'text-gray-500 bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'
                : 'text-purple-500 bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800'
            }`}
          >
            {currentStatus === 'rejected' ? (
              <XCircle className="w-5 h-5" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {currentStatus === 'rejected'
                ? isSimpleMode
                  ? 'この課題は見送りになりました'
                  : 'このIssueは却下されました'
                : isSimpleMode
                  ? 'この課題は重複として統合されました'
                  : 'このIssueは重複として統合されました'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {currentStatus === 'rejected'
                ? isSimpleMode
                  ? '必要に応じて新しい課題を報告できます'
                  : '必要に応じて新しいIssueを作成できます'
                : isSimpleMode
                  ? '統合先の課題をご確認ください'
                  : '統合先のIssueをご確認ください'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${className}`}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">PDCAの進行状況</h3>
        {currentOrder < lifecycleSteps.length - 1 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            次のステップ:{' '}
            {isSimpleMode
              ? lifecycleSteps[currentOrder + 1]?.simpleHint
              : lifecycleSteps[currentOrder + 1]?.hint}
          </span>
        )}
      </div>

      {/* ステップ表示 */}
      <div className="flex items-center gap-1">
        {lifecycleSteps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentOrder;
          const isPast = index < currentOrder;
          const isFuture = index > currentOrder;

          return (
            <React.Fragment key={`step-${index}`}>
              {/* ステップ */}
              <div className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={`
                    w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all
                    ${isActive ? step.activeColor : ''}
                    ${isPast ? 'text-green-500 bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800' : ''}
                    ${isFuture ? 'text-gray-300 dark:text-gray-600 bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700' : ''}
                  `}
                >
                  {isPast ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive
                      ? 'text-gray-900 dark:text-gray-100'
                      : isPast
                        ? 'text-green-600'
                        : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* 矢印（最後以外） */}
              {index < lifecycleSteps.length - 1 && (
                <ArrowRight
                  className={`w-4 h-4 flex-shrink-0 mb-5 ${
                    index < currentOrder ? 'text-green-400' : 'text-gray-200 dark:text-gray-600'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
