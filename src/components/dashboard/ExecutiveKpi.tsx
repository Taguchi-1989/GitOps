import Link from 'next/link';
import { AlertTriangle, TrendingUp, BarChart3, Flame } from 'lucide-react';

export interface ExecutiveKpiData {
  stalledCount: number;
  stalledThresholdDays: number;
  monthlyMerged: { month: string; count: number }[];
  adoptionRate: { merged: number; rejected: number; rate: number | null };
  topFlows: { flowId: string; count: number }[];
}

function MiniBars({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div className="flex items-end gap-1 h-16" aria-hidden="true">
      {data.map(d => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-blue-500 dark:bg-blue-400 rounded-t"
            style={{ height: `${(d.count / max) * 100}%`, minHeight: '2px' }}
          />
          <span className="text-[10px] text-gray-600 dark:text-gray-400">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

export function ExecutiveKpi({ data }: { data: ExecutiveKpiData }) {
  const { stalledCount, stalledThresholdDays, monthlyMerged, adoptionRate, topFlows } = data;
  const monthlyText = monthlyMerged.map(m => `${m.month}: ${m.count}件`).join('、');

  return (
    <section
      aria-label="経営層向けKPI"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle
            className={`w-5 h-5 ${stalledCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}
            aria-hidden="true"
          />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">停滞中の課題</h3>
        </div>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stalledCount}</p>
        <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
          {stalledThresholdDays}日以上更新なし
        </p>
        {stalledCount > 0 && (
          <Link
            href="/issues?status=open"
            className="mt-3 inline-flex text-sm text-red-700 dark:text-red-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
          >
            一覧を確認 →
          </Link>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">月次完了推移</h3>
        </div>
        <MiniBars data={monthlyMerged} />
        <p className="sr-only">過去6ヶ月の月次完了件数: {monthlyText}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-green-700 dark:text-green-300" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI採択率</h3>
        </div>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {adoptionRate.rate === null ? '—' : `${Math.round(adoptionRate.rate * 100)}%`}
        </p>
        <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
          直近30日: 採用 {adoptionRate.merged} / 却下 {adoptionRate.rejected}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            改善が多いフロー
          </h3>
        </div>
        {topFlows.length === 0 ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">データがありません</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {topFlows.map((f, i) => (
              <li key={f.flowId} className="flex items-center justify-between gap-2">
                <Link
                  href={`/flows/${f.flowId}`}
                  className="truncate text-blue-700 dark:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                >
                  {i + 1}. {f.flowId}
                </Link>
                <span className="text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {f.count}件
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
