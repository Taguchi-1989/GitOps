/**
 * FlowOps - Status Badge Component
 *
 * Issueステータスを色分けして表示
 */

import React from 'react';
import { IssueStatus } from '@/core/issue';

interface StatusBadgeProps {
  status: IssueStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<
  IssueStatus,
  { label: string; color: string; bg: string; emoji: string }
> = {
  new: {
    label: '起票',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    emoji: '🔴',
  },
  triage: {
    label: 'トリアージ',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    emoji: '🟠',
  },
  'in-progress': {
    label: '作業中',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    emoji: '🔵',
  },
  proposed: {
    label: '提案済',
    color: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    emoji: '🟡',
  },
  merged: {
    label: '完了',
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    emoji: '🟢',
  },
  rejected: {
    label: '却下',
    color: 'text-gray-700 dark:text-gray-300',
    bg: 'bg-gray-100 dark:bg-gray-700',
    emoji: '⚫',
  },
  'merged-duplicate': {
    label: '重複',
    color: 'text-purple-700 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    emoji: '🟣',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${config.bg} ${config.color} ${sizeClasses[size]} ${className}
      `}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}

const dotColors: Record<IssueStatus, string> = {
  new: 'bg-red-500',
  triage: 'bg-orange-500',
  'in-progress': 'bg-blue-500',
  proposed: 'bg-yellow-500',
  merged: 'bg-green-500',
  rejected: 'bg-gray-500',
  'merged-duplicate': 'bg-purple-500',
};

export function StatusDot({ status, className = '' }: { status: IssueStatus; className?: string }) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${dotColors[status]} ${className}`}
      title={config.label}
    />
  );
}
