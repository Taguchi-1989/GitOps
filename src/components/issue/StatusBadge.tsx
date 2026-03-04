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
    color: 'text-red-700',
    bg: 'bg-red-100',
    emoji: '🔴',
  },
  triage: {
    label: 'トリアージ',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    emoji: '🟠',
  },
  'in-progress': {
    label: '作業中',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    emoji: '🔵',
  },
  proposed: {
    label: '提案済',
    color: 'text-yellow-700',
    bg: 'bg-yellow-100',
    emoji: '🟡',
  },
  merged: {
    label: '完了',
    color: 'text-green-700',
    bg: 'bg-green-100',
    emoji: '🟢',
  },
  rejected: {
    label: '却下',
    color: 'text-gray-700',
    bg: 'bg-gray-100',
    emoji: '⚫',
  },
  'merged-duplicate': {
    label: '重複',
    color: 'text-purple-700',
    bg: 'bg-purple-100',
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
