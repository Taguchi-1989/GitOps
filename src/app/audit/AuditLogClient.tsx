/**
 * FlowOps - Audit Log Client
 *
 * 監査ログのフィルタ照会・ページング・レポート出力(CSV/HTML)。
 */

'use client';

import React, { useCallback, useState } from 'react';
import {
  Download,
  FileText,
  Filter,
  ScrollText,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/components/ui';
import { AuditActionSchema, AuditEntityTypeSchema } from '@/core/audit/types';

const PAGE_SIZE = 50;

interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  traceId: string | null;
  payload: string | null;
  createdAt: string;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface Filters {
  startDate: string;
  endDate: string;
  action: string;
  entityType: string;
  actor: string;
  traceId: string;
}

const EMPTY_FILTERS: Filters = {
  startDate: '',
  endDate: '',
  action: '',
  entityType: '',
  actor: '',
  traceId: '',
};

/** 適用済みフィルタからクエリ文字列を生成する(ページングパラメータは含めない)。 */
function buildFilterParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.action) params.set('action', filters.action);
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.actor) params.set('actor', filters.actor);
  if (filters.traceId) params.set('traceId', filters.traceId);
  return params;
}

function formatJst(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface AuditLogClientProps {
  initialLogs: AuditLogRow[];
  initialPagination: Pagination;
}

export function AuditLogClient({ initialLogs, initialPagination }: AuditLogClientProps) {
  const { addToast } = useToast();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  // 検索ボタン押下時点で確定したフィルタ(エクスポートもこれを使う)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [logs, setLogs] = useState<AuditLogRow[]>(initialLogs);
  const [pagination, setPagination] = useState<Pagination | null>(initialPagination);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(
    async (applied: Filters, pageOffset: number) => {
      setLoading(true);
      try {
        const params = buildFilterParams(applied);
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(pageOffset));
        const res = await fetch(`/api/audit?${params.toString()}`);
        const json = await res.json();
        if (!json.ok) {
          addToast(
            'error',
            `照会に失敗しました: ${json.details ?? json.errorCode ?? '不明なエラー'}`
          );
          return;
        }
        setLogs(json.data.logs);
        setPagination(json.data.pagination);
      } catch (e) {
        addToast('error', '照会中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    },
    [addToast]
  );

  const handleSearch = () => {
    setAppliedFilters(filters);
    setOffset(0);
    fetchLogs(filters, 0);
  };

  const handlePage = (newOffset: number) => {
    setOffset(newOffset);
    fetchLogs(appliedFilters, newOffset);
  };

  const handleExport = (format: 'csv' | 'html') => {
    const params = buildFilterParams(appliedFilters);
    params.set('format', format);
    const url = `/api/audit/export?${params.toString()}`;
    if (format === 'csv') {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener');
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderPayload = (payload: string | null) => {
    if (!payload) return <span className="text-gray-400">—</span>;
    try {
      const parsed = JSON.parse(payload);
      return (
        <pre className="text-xs whitespace-pre-wrap break-all bg-gray-50 dark:bg-gray-900 p-2 rounded">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return (
        <div className="text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
            <AlertCircle className="w-3 h-3" />
            payload解析エラー
          </span>
          <pre className="mt-1 whitespace-pre-wrap break-all">{payload}</pre>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <ScrollText className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">監査ログ</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            誰が・いつ・何を・なぜ・AIがどう関与したか — 操作履歴の照会と監査レポート出力
          </p>
        </div>
      </div>

      {/* フィルタバー */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Filter className="w-4 h-4" />
          フィルタ
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            開始日
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters({ ...filters, startDate: e.target.value })}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            終了日
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters({ ...filters, endDate: e.target.value })}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            アクション
            <select
              value={filters.action}
              onChange={e => setFilters({ ...filters, action: e.target.value })}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">すべて</option>
              {AuditActionSchema.options.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            対象種別
            <select
              value={filters.entityType}
              onChange={e => setFilters({ ...filters, entityType: e.target.value })}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">すべて</option>
              {AuditEntityTypeSchema.options.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            操作者
            <input
              type="text"
              value={filters.actor}
              onChange={e => setFilters({ ...filters, actor: e.target.value })}
              placeholder="例: admin"
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            TraceID
            <input
              type="text"
              value={filters.traceId}
              onChange={e => setFilters({ ...filters, traceId: e.target.value })}
              placeholder="trace-..."
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Filter className="w-4 h-4" />
            検索
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setAppliedFilters(EMPTY_FILTERS);
              setOffset(0);
              fetchLogs(EMPTY_FILTERS, 0);
            }}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            クリア
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            CSVダウンロード
          </button>
          <button
            type="button"
            onClick={() => handleExport('html')}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            レポート表示
          </button>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">日時</th>
                <th className="text-left px-3 py-2 font-medium">操作者</th>
                <th className="text-left px-3 py-2 font-medium">アクション</th>
                <th className="text-left px-3 py-2 font-medium">対象</th>
                <th className="text-left px-3 py-2 font-medium">TraceID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                    該当する監査ログはありません
                  </td>
                </tr>
              )}
              {logs.map(log => {
                const isOpen = expanded.has(log.id);
                return (
                  <React.Fragment key={log.id}>
                    <tr
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      onClick={() => toggleExpand(log.id)}
                    >
                      <td className="px-3 py-2 text-gray-400">
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                        {formatJst(log.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{log.actor}</td>
                      <td className="px-3 py-2">
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-medium">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                        {log.entityType} / <span className="text-gray-500">{log.entityId}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                        {log.traceId ?? '—'}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50/50 dark:bg-gray-900/30">
                        <td />
                        <td colSpan={5} className="px-3 py-2">
                          {renderPayload(log.payload)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ページング */}
        {pagination && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
            <span>
              全 {pagination.total} 件中 {pagination.total === 0 ? 0 : offset + 1}–
              {offset + logs.length} 件
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0 || loading}
                onClick={() => handlePage(Math.max(0, offset - PAGE_SIZE))}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                前へ
              </button>
              <button
                type="button"
                disabled={!pagination.hasMore || loading}
                onClick={() => handlePage(offset + PAGE_SIZE)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
