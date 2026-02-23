/**
 * FlowOps - Issue Card Component
 *
 * Issue一覧で使用するカードコンポーネント
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { StatusBadge } from './StatusBadge';
import { IssueStatus } from '@/core/issue';
import { FileText, GitBranch, Clock } from 'lucide-react';

export interface IssueCardData {
  id: string;
  humanId: string;
  title: string;
  description: string;
  status: IssueStatus;
  targetFlowId?: string | null;
  targetNodeId?: string | null;
  branchName?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface IssueCardProps {
  issue: IssueCardData;
  onClick?: () => void;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function IssueCard({ issue, onClick }: IssueCardProps) {
  const cardClassName = `
    block w-full text-left
    bg-white border border-gray-200 rounded-lg p-4
    hover:border-blue-300 hover:shadow-md
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
  `;

  const cardContent = (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-gray-500">{issue.humanId}</span>
            <StatusBadge status={issue.status} size="sm" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 truncate">{issue.title}</h3>
        </div>
      </div>

      {/* Description */}
      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{issue.description}</p>

      {/* Meta */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        {issue.targetFlowId && (
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {issue.targetFlowId}
            {issue.targetNodeId && (
              <span className="text-gray-400"> &gt; {issue.targetNodeId}</span>
            )}
          </span>
        )}

        {issue.branchName && (
          <span className="flex items-center gap-1">
            <GitBranch className="w-3.5 h-3.5" />
            <span className="font-mono">{issue.branchName}</span>
          </span>
        )}

        <span className="flex items-center gap-1 ml-auto">
          <Clock className="w-3.5 h-3.5" />
          {formatDate(issue.updatedAt)}
        </span>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} type="button" className={cardClassName}>
        {cardContent}
      </button>
    );
  }

  return (
    <Link href={`/issues/${issue.id}`} className={cardClassName}>
      {cardContent}
    </Link>
  );
}

/**
 * Issue一覧用のスケルトンローダー
 */
export function IssueCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-5 w-20 bg-gray-200 rounded-full" />
          </div>
          <div className="h-5 w-3/4 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-4 w-2/3 bg-gray-200 rounded" />
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="h-3 w-24 bg-gray-200 rounded" />
        <div className="h-3 w-20 bg-gray-200 rounded ml-auto" />
      </div>
    </div>
  );
}
