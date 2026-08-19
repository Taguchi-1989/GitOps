/**
 * FlowOps - Issue List Component
 *
 * 改善カード一覧表示（タブ付き）。
 * タブの語彙はバッジと同じ（@/lib/issue-status-ui が正本）。
 */

'use client';

import React, { useState } from 'react';
import { IssueCard, IssueCardData, IssueCardSkeleton } from './IssueCard';
import { Plus, Search, MousePointerClick, Sparkles } from 'lucide-react';
import { getIssueTab, ISSUE_TAB_CONFIG, IssueTabValue } from '@/lib/issue-status-ui';
import { NextStepCard } from '@/components/ui/NextStepCard';

interface IssueListProps {
  issues: IssueCardData[];
  isLoading?: boolean;
  onCreateClick?: () => void;
  /** 初期表示タブ（ダッシュボードの統計カードから ?tab= で指定される） */
  initialTab?: IssueTabValue;
}

export function IssueList({
  issues,
  isLoading = false,
  onCreateClick,
  initialTab = 'open',
}: IssueListProps) {
  const [activeTab, setActiveTab] = useState<IssueTabValue>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  const counts = (Object.keys(ISSUE_TAB_CONFIG) as IssueTabValue[]).reduce(
    (acc, key) => {
      acc[key] = issues.filter(i => getIssueTab(i.status, i.standardizedAt) === key).length;
      return acc;
    },
    {} as Record<IssueTabValue, number>
  );

  const filteredIssues = issues.filter(issue => {
    if (getIssueTab(issue.status, issue.standardizedAt) !== activeTab) {
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">改善カード</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            現場の困りごとと改善の管理
          </p>
        </div>
        {onCreateClick && (
          <button
            type="button"
            onClick={onCreateClick}
            className="
              flex min-h-11 items-center justify-center gap-2 px-4 py-2
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

      {/* 「次にすること」は常に1つだけ出す（読み込み中は状態が確定しないので出さない） */}
      {!isLoading &&
        (issues.length === 0 ? (
          <NextStepCard
            icon={Plus}
            title="「新規作成」を押して、最初の改善カードを作りましょう"
            description="いま困っていること・やりにくいことを書くだけで大丈夫です。あとからAIが改善案を考えてくれます。"
            action={onCreateClick ? { label: '新規作成', onClick: onCreateClick } : undefined}
            dismissKey="issue-list-empty"
          />
        ) : counts.open > 0 || counts.checking > 0 ? (
          <NextStepCard
            icon={MousePointerClick}
            title="対応中の改善カードを開いて、次の作業を進めてください"
            description={`「${ISSUE_TAB_CONFIG.open.label}」と「${ISSUE_TAB_CONFIG.checking.label}」のカードには、まだやることが残っています。開くと「次にすること」が表示されます。`}
            hint="下の一覧から、カードの見出しをクリックしてください"
            dismissKey="issue-list"
          />
        ) : (
          <NextStepCard
            icon={Sparkles}
            title="やることは残っていません。次の困りごとがあれば「新規作成」へ"
            description="すべての改善カードが完了・見送りになりました。気づいたことがあれば、また改善カードを作りましょう。"
            action={onCreateClick ? { label: '新規作成', onClick: onCreateClick } : undefined}
            dismissKey="issue-list-done"
          />
        ))}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex flex-wrap gap-2 sm:gap-4" aria-label="Tabs">
          {Object.entries(ISSUE_TAB_CONFIG).map(([key, config]) => (
            <button
              type="button"
              key={key}
              onClick={() => setActiveTab(key as IssueTabValue)}
              className={`
                min-h-11 px-3 py-2 text-sm font-medium border-b-2 -mb-px
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
                {counts[key as IssueTabValue]}
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
          placeholder="改善カードを検索..."
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
              {searchQuery ? '該当する改善カードがありません' : 'まだ改善カードがありません'}
            </div>
            {!searchQuery && onCreateClick && (
              <button
                type="button"
                onClick={onCreateClick}
                className="text-blue-600 hover:text-blue-700"
              >
                最初の改善カードを作る
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
