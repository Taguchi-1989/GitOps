/**
 * FlowOps - Issue List Component
 * 
 * Issue一覧表示（タブ付き）
 */

'use client';

import React, { useState } from 'react';
import { IssueCard, IssueCardData, IssueCardSkeleton } from './IssueCard';
import { IssueStatus } from '@/core/issue';
import { Plus, Filter, Search } from 'lucide-react';

interface IssueListProps {
  issues: IssueCardData[];
  isLoading?: boolean;
  onCreateClick?: () => void;
}

type TabValue = 'open' | 'proposed' | 'closed';

const tabConfig: Record<TabValue, { label: string; statuses: IssueStatus[] }> = {
  open: {
    label: 'Open',
    statuses: ['new', 'triage', 'in-progress'],
  },
  proposed: {
    label: 'Proposed',
    statuses: ['proposed'],
  },
  closed: {
    label: 'Closed',
    statuses: ['merged', 'rejected', 'merged-duplicate'],
  },
};

export function IssueList({ issues, isLoading = false, onCreateClick }: IssueListProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('open');
  const [searchQuery, setSearchQuery] = useState('');

  // タブごとのIssue数をカウント
  const counts = Object.entries(tabConfig).reduce((acc, [key, config]) => {
    acc[key as TabValue] = issues.filter(i => config.statuses.includes(i.status)).length;
    return acc;
  }, {} as Record<TabValue, number>);

  // フィルタリング
  const filteredIssues = issues.filter(issue => {
    // タブフィルター
    if (!tabConfig[activeTab].statuses.includes(issue.status)) {
      return false;
    }
    
    // 検索フィルター
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
        <h1 className="text-2xl font-bold text-gray-900">Issues</h1>
        {onCreateClick && (
          <button
            onClick={onCreateClick}
            className="
              flex items-center gap-2 px-4 py-2
              bg-blue-600 text-white rounded-lg
              hover:bg-blue-700 transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            "
          >
            <Plus className="w-4 h-4" />
            New Issue
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4" aria-label="Tabs">
          {Object.entries(tabConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as TabValue)}
              className={`
                px-3 py-2 text-sm font-medium border-b-2 -mb-px
                transition-colors
                ${activeTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {config.label}
              <span className={`
                ml-2 px-2 py-0.5 rounded-full text-xs
                ${activeTab === key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
              `}>
                {counts[key as TabValue]}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search issues..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="
            w-full pl-10 pr-4 py-2
            border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          "
        />
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          // スケルトンローダー
          Array.from({ length: 3 }).map((_, i) => (
            <IssueCardSkeleton key={i} />
          ))
        ) : filteredIssues.length === 0 ? (
          // 空状態
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">
              {searchQuery ? 'No matching issues found' : 'No issues yet'}
            </div>
            {!searchQuery && onCreateClick && (
              <button
                onClick={onCreateClick}
                className="text-blue-600 hover:text-blue-700"
              >
                Create your first issue
              </button>
            )}
          </div>
        ) : (
          // Issue一覧
          filteredIssues.map(issue => (
            <IssueCard key={issue.id} issue={issue} />
          ))
        )}
      </div>
    </div>
  );
}
