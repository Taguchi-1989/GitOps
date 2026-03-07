/**
 * FlowOps - Issue List Component
 *
 * Issue一覧表示（タブ付き）
 */

'use client';

import React, { useState } from 'react';
import { IssueCard, IssueCardData, IssueCardSkeleton } from './IssueCard';
import { IssueStatus } from '@/core/issue';
import { Plus, Search } from 'lucide-react';

interface IssueListProps {
  issues: IssueCardData[];
  isLoading?: boolean;
  onCreateClick?: () => void;
}

type TabValue = 'open' | 'proposed' | 'closed';

const tabConfig: Record<TabValue, { label: string; statuses: IssueStatus[] }> = {
  open: {
    label: '未対応',
    statuses: ['new', 'triage', 'in-progress'],
  },
  proposed: {
    label: '提案済',
    statuses: ['proposed'],
  },
  closed: {
    label: '完了',
    statuses: ['merged', 'rejected', 'merged-duplicate'],
  },
};

export function IssueList({ issues, isLoading = false, onCreateClick }: IssueListProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('open');
  const [searchQuery, setSearchQuery] = useState('');

  const counts = Object.entries(tabConfig).reduce(
    (acc, [key, config]) => {
      acc[key as TabValue] = issues.filter(i => config.statuses.includes(i.status)).length;
      return acc;
    },
    {} as Record<TabValue, number>
  );

  const filteredIssues = issues.filter(issue => {
    if (!tabConfig[activeTab].statuses.includes(issue.status)) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        issue.title.toLowerCase().includes(query) ||
        issue.description.toLowerCase().includes(query) ||
        issue.humanId.toLowerCase().includes(query)
      );
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Issue</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">課題や改善点の管理</p>
        </div>
        {onCreateClick && (
          <button
            type="button"
            onClick={onCreateClick}
            className="
              flex items-center gap-2 px-4 py-2
              bg-blue-600 text-white rounded-lg
              hover:bg-blue-700 transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            "
          >
            <Plus className="w-4 h-4" />
            新規作成
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4" aria-label="Tabs">
          {Object.entries(tabConfig).map(([key, config]) => (
            <button
              type="button"
              key={key}
              onClick={() => setActiveTab(key as TabValue)}
              className={`
                px-3 py-2 text-sm font-medium border-b-2 -mb-px
                transition-colors
                ${
                  activeTab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              {config.label}
              <span
                className={`
                ml-2 px-2 py-0.5 rounded-full text-xs
                ${activeTab === key ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}
              `}
              >
                {counts[key as TabValue]}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          placeholder="Issueを検索..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="
            w-full pl-10 pr-4 py-2
            border border-gray-300 dark:border-gray-600 rounded-lg
            bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          "
        />
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <IssueCardSkeleton key={i} />)
        ) : filteredIssues.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 text-lg mb-2">
              {searchQuery ? '該当するIssueがありません' : 'まだIssueがありません'}
            </div>
            {!searchQuery && onCreateClick && (
              <button
                type="button"
                onClick={onCreateClick}
                className="text-blue-600 hover:text-blue-700"
              >
                最初のIssueを作成する
              </button>
            )}
          </div>
        ) : (
          filteredIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)
        )}
      </div>
    </div>
  );
}
