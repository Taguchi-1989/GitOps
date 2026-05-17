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

  const tabKeys = Object.keys(tabConfig) as TabValue[];
  const handleTabKeyDown = (e: React.KeyboardEvent, currentKey: TabValue) => {
    const i = tabKeys.indexOf(currentKey);
    const n = tabKeys.length;
    const target: Record<string, TabValue | undefined> = {
      ArrowRight: tabKeys[(i + 1) % n],
      ArrowLeft: tabKeys[(i - 1 + n) % n],
      Home: tabKeys[0],
      End: tabKeys[n - 1],
    };
    if (target[e.key]) {
      e.preventDefault();
      setActiveTab(target[e.key]!);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">課題</h1>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">課題や改善点の管理</p>
        </div>
        {onCreateClick && (
          <button
            type="button"
            onClick={onCreateClick}
            className="
              inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-11
              bg-blue-600 text-white rounded-lg font-medium
              hover:bg-blue-700 transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
            "
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            新規作成
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div
          role="tablist"
          aria-label="課題のステータス別タブ"
          className="flex gap-2 sm:gap-4 overflow-x-auto"
        >
          {Object.entries(tabConfig).map(([key, config]) => {
            const isActive = activeTab === key;
            return (
              <button
                type="button"
                key={key}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(key as TabValue)}
                onKeyDown={e => handleTabKeyDown(e, key as TabValue)}
                aria-label={`${config.label} (${counts[key as TabValue]}件)`}
                className={`
                  inline-flex items-center px-3 py-2.5 min-h-11 text-sm font-medium border-b-2 -mb-px
                  transition-colors whitespace-nowrap
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-t
                  ${
                    isActive
                      ? 'border-blue-600 text-blue-700 dark:text-blue-300'
                      : 'border-transparent text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500'
                  }
                `}
              >
                {config.label}
                <span
                  aria-hidden="true"
                  className={`
                  ml-2 px-2 py-0.5 rounded-full text-xs
                  ${isActive ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}
                `}
                >
                  {counts[key as TabValue]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <label htmlFor="issue-search" className="sr-only">
          課題を検索
        </label>
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          id="issue-search"
          type="search"
          placeholder="課題を検索（タイトル・説明・ID）..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="
            w-full pl-10 pr-4 py-2.5 min-h-11
            border border-gray-300 dark:border-gray-600 rounded-lg
            bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
            placeholder:text-gray-500 dark:placeholder:text-gray-400
            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus:border-transparent
          "
        />
      </div>

      {/* List */}
      <div
        role="region"
        aria-label={`${tabConfig[activeTab].label}の課題一覧`}
        aria-live="polite"
        aria-busy={isLoading}
        className="space-y-3"
      >
        {isLoading ? (
          <>
            <span className="sr-only">読み込み中...</span>
            {Array.from({ length: 3 }).map((_, i) => (
              <IssueCardSkeleton key={i} />
            ))}
          </>
        ) : filteredIssues.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-700 dark:text-gray-200 text-lg mb-2">
              {searchQuery ? '該当する課題がありません' : 'まだ課題がありません'}
            </p>
            {!searchQuery && onCreateClick && (
              <button
                type="button"
                onClick={onCreateClick}
                className="inline-flex items-center min-h-11 px-3 text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              >
                最初の課題を作成する
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
