/**
 * FlowOps - Status Badge Component
 *
 * Issueステータスを色分けして表示（定義は @/lib/issue-status-ui に集約）
 */

import React from 'react';
import { IssueStatus } from '@/core/issue';
import { getStatusUi } from '@/lib/issue-status-ui';

interface StatusBadgeProps {
  status: IssueStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const config = getStatusUi(status);

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

export function StatusDot({ status, className = '' }: { status: IssueStatus; className?: string }) {
  const config = getStatusUi(status);

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${config.dot} ${className}`}
      title={config.label}
    />
  );
}
