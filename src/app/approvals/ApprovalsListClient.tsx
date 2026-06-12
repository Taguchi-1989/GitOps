/**
 * FlowOps - 承認待ち一覧クライアントコンポーネント
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { ClipboardCheck, Clock, ArrowRight } from 'lucide-react';
import { formatDateWithYear as formatDate } from '@/lib/format-date';

interface ApprovalItem {
  id: string;
  workflowId: string;
  nodeId: string;
  description: string;
  createdAt: Date | string;
  flowId: string;
  workflowStatus: string;
}

interface ApprovalsListClientProps {
  approvals: ApprovalItem[];
}

export function ApprovalsListClient({ approvals }: ApprovalsListClientProps) {
  return (
    <div>
      {/* ページヘッダー */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ClipboardCheck className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">承認待ち</h1>
          {approvals.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              {approvals.length}件
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          人による判断が必要なワークフローの一覧です。判断カードを開いて承認または差し戻しを行ってください。
        </p>
      </div>

      {/* 一覧 / 空状態 */}
      {approvals.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-700 dark:text-gray-300">承認待ちはありません</p>
          <p className="text-sm mt-1">現在、判断が必要なワークフローはありません。</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {approvals.map(item => (
            <li key={item.id}>
              <Link
                href={`/approvals/${item.id}`}
                className="
                  flex items-center gap-4 p-4
                  border border-gray-200 dark:border-gray-700
                  bg-white dark:bg-gray-800 rounded-lg
                  hover:border-blue-400 dark:hover:border-blue-600
                  hover:shadow-sm transition-all group
                "
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                      {item.flowId}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">/</span>
                    <span className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate">
                      {item.nodeId}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-medium line-clamp-2">
                    {item.description}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    <Clock className="w-3 h-3" />
                    {formatDate(item.createdAt)}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
