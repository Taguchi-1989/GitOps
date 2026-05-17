'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Filter, RefreshCw } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  traceId: string | null;
  payload: string | null;
  createdAt: string;
}

interface Filters {
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  traceId: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FILTERS: Filters = {
  entityType: '',
  entityId: '',
  action: '',
  actor: '',
  traceId: '',
  startDate: '',
  endDate: '',
};

const ENTITY_TYPES = [
  'Issue',
  'Proposal',
  'Flow',
  'Evidence',
  'WorkflowExecution',
  'DataObject',
  'System',
];

const ACTIONS = [
  'ISSUE_CREATE',
  'ISSUE_UPDATE',
  'ISSUE_START',
  'ISSUE_CLOSE',
  'ISSUE_DELETE',
  'PROPOSAL_GENERATE',
  'PATCH_APPLY',
  'MERGE_CLOSE',
  'DUPLICATE_MERGE',
  'GIT_COMMIT',
  'GIT_BRANCH_CREATE',
  'GIT_BRANCH_DELETE',
  'WORKFLOW_START',
  'WORKFLOW_COMPLETE',
  'WORKFLOW_FAIL',
  'WORKFLOW_CANCEL',
  'TASK_EXECUTE',
  'HUMAN_APPROVE',
  'HUMAN_REJECT',
  'FLOW_CREATE',
  'FLOW_UPDATE',
  'FLOW_IMPORT',
  'BACKUP_CREATE',
  'DATA_ACCESS',
  'DATA_EXPORT',
  'ABSTRACTION_APPLIED',
  'PROVENANCE_RECORDED',
  'ACCESS_POLICY_CHANGE',
];

const PAGE_SIZE = 50;

function buildQuery(filters: Filters, offset: number): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  params.set('limit', String(PAGE_SIZE));
  params.set('offset', String(offset));
  return params.toString();
}

function entityHref(entityType: string, entityId: string): string | null {
  if (entityType === 'Issue') return `/issues/${entityId}`;
  if (entityType === 'Flow') return `/flows/${entityId}`;
  return null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function PayloadCell({ payload }: { payload: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!payload) return <span className="text-gray-500 dark:text-gray-400">—</span>;

  let pretty = payload;
  try {
    pretty = JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    /* keep raw */
  }

  const short = pretty.length > 80 ? pretty.slice(0, 80) + '...' : pretty;
  return (
    <button
      type="button"
      onClick={() => setExpanded(v => !v)}
      aria-expanded={expanded}
      className="text-left font-mono text-xs text-gray-700 dark:text-gray-200 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
    >
      {expanded ? <pre className="whitespace-pre-wrap">{pretty}</pre> : short}
    </button>
  );
}

export function AuditLogClient() {
  const { addToast } = useToast();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = useCallback(
    async (f: Filters, off: number) => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/audit?${buildQuery(f, off)}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.details || '取得に失敗しました');
        setLogs(data.data.logs);
        setTotal(data.data.pagination.total);
      } catch (e) {
        addToast('error', e instanceof Error ? e.message : '取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    fetchLogs(appliedFilters, offset);
  }, [appliedFilters, offset, fetchLogs]);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setAppliedFilters(filters);
  };

  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setOffset(0);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const downloadCsv = () => {
    const params = new URLSearchParams();
    Object.entries(appliedFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    params.set('format', 'csv');
    window.location.href = `/api/audit?${params.toString()}`;
  };

  const inputClass =
    'w-full px-3 py-2 min-h-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

  return (
    <div className="space-y-4">
      <form
        onSubmit={apply}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4"
        aria-label="監査ログ絞り込みフォーム"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-700 dark:text-gray-300" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">絞り込み</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="f-entityType"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              対象種別
            </label>
            <select
              id="f-entityType"
              className={inputClass}
              value={filters.entityType}
              onChange={e => setFilters(p => ({ ...p, entityType: e.target.value }))}
            >
              <option value="">すべて</option>
              {ENTITY_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="f-action"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              アクション
            </label>
            <select
              id="f-action"
              className={inputClass}
              value={filters.action}
              onChange={e => setFilters(p => ({ ...p, action: e.target.value }))}
            >
              <option value="">すべて</option>
              {ACTIONS.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="f-actor"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              実行者
            </label>
            <input
              id="f-actor"
              type="text"
              className={inputClass}
              placeholder="actor名"
              value={filters.actor}
              onChange={e => setFilters(p => ({ ...p, actor: e.target.value }))}
            />
          </div>
          <div>
            <label
              htmlFor="f-entityId"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              対象ID
            </label>
            <input
              id="f-entityId"
              type="text"
              className={inputClass}
              placeholder="Issue/Flow等のID"
              value={filters.entityId}
              onChange={e => setFilters(p => ({ ...p, entityId: e.target.value }))}
            />
          </div>
          <div>
            <label
              htmlFor="f-traceId"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Trace ID
            </label>
            <input
              id="f-traceId"
              type="text"
              className={inputClass}
              placeholder="E2Eトレース用ID"
              value={filters.traceId}
              onChange={e => setFilters(p => ({ ...p, traceId: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="f-startDate"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                開始日
              </label>
              <input
                id="f-startDate"
                type="date"
                className={inputClass}
                value={filters.startDate}
                onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label
                htmlFor="f-endDate"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                終了日
              </label>
              <input
                id="f-endDate"
                type="date"
                className={inputClass}
                value={filters.endDate}
                onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center px-4 py-2 min-h-11 text-sm font-medium text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            クリア
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-11 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            絞り込む
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-11 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            CSV出力
          </button>
        </div>
      </form>

      <div
        role="region"
        aria-label="監査ログ一覧"
        aria-busy={isLoading}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" />
                読み込み中...
              </span>
            ) : (
              <>
                {total.toLocaleString()} 件中 {Math.min(offset + 1, total)}〜
                {Math.min(offset + logs.length, total)} 件を表示
              </>
            )}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
              <tr>
                <th scope="col" className="px-4 py-2 whitespace-nowrap">
                  日時
                </th>
                <th scope="col" className="px-4 py-2 whitespace-nowrap">
                  実行者
                </th>
                <th scope="col" className="px-4 py-2 whitespace-nowrap">
                  アクション
                </th>
                <th scope="col" className="px-4 py-2 whitespace-nowrap">
                  対象
                </th>
                <th scope="col" className="px-4 py-2 whitespace-nowrap">
                  Trace
                </th>
                <th scope="col" className="px-4 py-2">
                  内容
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {!isLoading && logs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-700 dark:text-gray-300"
                  >
                    該当する監査ログがありません
                  </td>
                </tr>
              )}
              {logs.map(log => {
                const href = entityHref(log.entityType, log.entityId);
                return (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-200">
                      <time dateTime={log.createdAt}>{formatDate(log.createdAt)}</time>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-gray-100">
                      {log.actor}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap font-mono text-xs text-blue-800 dark:text-blue-300">
                      {log.action}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {log.entityType}
                      </span>{' '}
                      {href ? (
                        <Link
                          href={href}
                          className="font-mono text-xs text-blue-700 dark:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                        >
                          {log.entityId}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs">{log.entityId}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {log.traceId ? (
                        <Link
                          href={`/governance/trace/${log.traceId}`}
                          className="font-mono text-xs text-blue-700 dark:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                        >
                          {log.traceId.slice(0, 8)}...
                        </Link>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 max-w-md">
                      <PayloadCell payload={log.payload} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || isLoading}
            className="inline-flex items-center justify-center px-3 py-2 min-h-10 text-sm font-medium text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            前へ
          </button>
          <span className="text-xs text-gray-700 dark:text-gray-300">
            ページ {Math.floor(offset / PAGE_SIZE) + 1} /{' '}
            {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </span>
          <button
            type="button"
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + logs.length >= total || isLoading}
            className="inline-flex items-center justify-center px-3 py-2 min-h-10 text-sm font-medium text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  );
}
