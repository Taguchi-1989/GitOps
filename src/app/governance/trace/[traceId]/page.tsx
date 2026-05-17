import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/core/audit/logger';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Bot,
  GitCommit,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ traceId: string }>;
}

async function getTrace(traceId: string) {
  const execution = await prisma.workflowExecution.findUnique({
    where: { traceId },
    include: {
      taskExecutions: { orderBy: { createdAt: 'asc' } },
      approvalRequests: { orderBy: { createdAt: 'asc' } },
    },
  });
  const auditLogs = await auditLog.query({ traceId });
  if (!execution && auditLogs.length === 0) return null;

  const llmModelsUsed = execution
    ? [
        ...new Set(
          execution.taskExecutions.map(t => t.llmModelUsed).filter((m): m is string => !!m)
        ),
      ]
    : [];

  const langfuseHost = process.env.LANGFUSE_HOST || process.env.NEXT_PUBLIC_LANGFUSE_HOST;
  const langfuseTraceUrl = langfuseHost ? `${langfuseHost}/trace/${traceId}` : null;

  return { traceId, execution, auditLogs, llmModelsUsed, langfuseTraceUrl };
}

export async function generateMetadata({ params }: PageProps) {
  const { traceId } = await params;
  return { title: `Trace ${traceId.slice(0, 8)}... - FlowOps` };
}

function fmt(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('ja-JP');
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; label: string; icon: typeof CheckCircle2 }> = {
    completed: {
      bg: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
      label: '完了',
      icon: CheckCircle2,
    },
    running: {
      bg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
      label: '実行中',
      icon: Clock,
    },
    failed: {
      bg: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
      label: '失敗',
      icon: XCircle,
    },
    cancelled: {
      bg: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
      label: 'キャンセル',
      icon: XCircle,
    },
    'paused-human-review': {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
      label: '人間承認待ち',
      icon: Clock,
    },
    approved: {
      bg: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
      label: '承認',
      icon: CheckCircle2,
    },
    rejected: {
      bg: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
      label: '却下',
      icon: XCircle,
    },
    pending: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
      label: '保留',
      icon: Clock,
    },
  };
  const cfg = map[status] || {
    bg: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    label: status,
    icon: Clock,
  };
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

export default async function TracePage({ params }: PageProps) {
  const { traceId } = await params;
  const data = await getTrace(traceId);
  if (!data) notFound();

  const { execution, auditLogs, llmModelsUsed, langfuseTraceUrl } = data;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
      <Link
        href="/audit"
        className="inline-flex items-center gap-1 min-h-11 px-2 -ml-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        監査ログへ戻る
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-700 dark:text-blue-300" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            ガバナンストレース
          </h1>
        </div>
        <p className="font-mono text-xs sm:text-sm text-gray-700 dark:text-gray-300 break-all">
          {traceId}
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          AI実行・人間承認・操作履歴を一気通貫で表示します (ISO/IEC 42001 トレーサビリティ)。
        </p>
      </header>

      {/* サマリ */}
      <section aria-label="サマリ" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-700 dark:text-gray-300">タスク実行</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {execution?.taskExecutions.length ?? 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-700 dark:text-gray-300">人間承認</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {execution?.approvalRequests.length ?? 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-700 dark:text-gray-300">監査エントリ</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {auditLogs.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-700 dark:text-gray-300">使用LLM</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {llmModelsUsed.length > 0 ? llmModelsUsed.join(', ') : '—'}
          </p>
        </div>
      </section>

      {/* ワークフロー実行情報 */}
      {execution && (
        <section
          aria-label="ワークフロー実行情報"
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            ワークフロー
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-700 dark:text-gray-300">状態</dt>
              <dd className="mt-1">
                <StatusPill status={execution.status} />
              </dd>
            </div>
            <div>
              <dt className="text-gray-700 dark:text-gray-300">フロー</dt>
              <dd className="mt-1">
                <Link
                  href={`/flows/${execution.flowId}`}
                  className="font-mono text-blue-700 dark:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                >
                  {execution.flowId}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-gray-700 dark:text-gray-300">開始</dt>
              <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(execution.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-gray-700 dark:text-gray-300">完了</dt>
              <dd className="mt-1 text-gray-900 dark:text-gray-100">
                {fmt(execution.completedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-700 dark:text-gray-300">起動者</dt>
              <dd className="mt-1 text-gray-900 dark:text-gray-100">
                {execution.initiatorId || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-700 dark:text-gray-300">現在ノード</dt>
              <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100">
                {execution.currentNodeId || '—'}
              </dd>
            </div>
          </dl>
          {langfuseTraceUrl && (
            <a
              href={langfuseTraceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-sm text-blue-700 dark:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              Langfuseで詳細を見る
            </a>
          )}
        </section>
      )}

      {/* タスク実行 */}
      {execution && execution.taskExecutions.length > 0 && (
        <section
          aria-label="AIタスク実行"
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-700 dark:text-purple-300" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AIタスク実行</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                <tr>
                  <th scope="col" className="px-4 py-2">
                    ノード
                  </th>
                  <th scope="col" className="px-4 py-2">
                    タスク (バージョン)
                  </th>
                  <th scope="col" className="px-4 py-2">
                    状態
                  </th>
                  <th scope="col" className="px-4 py-2">
                    LLM
                  </th>
                  <th scope="col" className="px-4 py-2">
                    入力/出力Token
                  </th>
                  <th scope="col" className="px-4 py-2">
                    所要
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Commit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {execution.taskExecutions.map(t => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">
                      {t.nodeId}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">
                      {t.taskId}{' '}
                      <span className="text-gray-700 dark:text-gray-300">({t.taskVersion})</span>
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill status={t.status} />
                    </td>
                    <td className="px-4 py-2 text-gray-800 dark:text-gray-200">
                      {t.llmModelUsed || '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      {t.llmTokensInput ?? '—'} / {t.llmTokensOutput ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      {t.durationMs ? `${t.durationMs}ms` : '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                      <span className="inline-flex items-center gap-1">
                        <GitCommit className="w-3 h-3" aria-hidden="true" />
                        {t.gitCommitHash.slice(0, 8)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 人間承認 */}
      {execution && execution.approvalRequests.length > 0 && (
        <section
          aria-label="人間承認"
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <ShieldCheck
              className="w-5 h-5 text-green-700 dark:text-green-300"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">人間承認</h2>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {execution.approvalRequests.map(a => (
              <li key={a.id} className="px-4 sm:px-6 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {a.description || a.nodeId}
                    </p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
                      {a.decidedBy ? `${a.decidedBy} が ${fmt(a.decidedAt)} に判断` : '未判断'}
                    </p>
                  </div>
                  <StatusPill status={a.status} />
                </div>
                {a.reason && (
                  <p className="mt-2 text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/40 rounded p-2">
                    判断理由: {a.reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 監査ログ */}
      <section
        aria-label="監査ログ"
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div className="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            関連監査ログ ({auditLogs.length}件)
          </h2>
          <Link
            href={`/audit?traceId=${traceId}`}
            className="text-xs text-blue-700 dark:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            監査ログで詳細表示 →
          </Link>
        </div>
        {auditLogs.length === 0 ? (
          <p className="px-4 sm:px-6 py-8 text-center text-gray-700 dark:text-gray-300">
            このTrace IDに紐づく監査ログはありません
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {auditLogs.slice(0, 10).map(log => (
              <li key={log.id} className="px-4 sm:px-6 py-2 flex items-center gap-3 flex-wrap">
                <time
                  dateTime={new Date(log.createdAt).toISOString()}
                  className="text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap"
                >
                  {fmt(log.createdAt)}
                </time>
                <span className="text-xs text-gray-700 dark:text-gray-300">{log.actor}</span>
                <span className="font-mono text-xs text-blue-800 dark:text-blue-300">
                  {log.action}
                </span>
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {log.entityType}:<span className="font-mono">{log.entityId}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
