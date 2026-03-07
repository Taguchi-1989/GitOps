/**
 * FlowOps - Dashboard Page
 *
 * ホームページ / ダッシュボード
 * - はじめてガイド（チェックリスト）
 * - 統計カード
 * - ワークフロー概要図
 */

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { listFlows } from '@/lib/flow-service';
import { TaskQueue } from '@/components/ui/TaskQueue';
import {
  FileText,
  AlertCircle,
  GitBranch,
  CheckCircle,
  Clock,
  ArrowRight,
  Sparkles,
  GitMerge,
  Play,
  Eye,
  Plus,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getDashboardStats() {
  const [issueStats, recentIssues, flows] = await Promise.all([
    prisma.issue.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.issue.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        humanId: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    }),
    listFlows(),
  ]);

  const stats = {
    total: 0,
    open: 0,
    inProgress: 0,
    proposed: 0,
    merged: 0,
  };

  issueStats.forEach(s => {
    stats.total += s._count.id;
    if (s.status === 'new' || s.status === 'triage') {
      stats.open += s._count.id;
    } else if (s.status === 'in-progress') {
      stats.inProgress += s._count.id;
    } else if (s.status === 'proposed') {
      stats.proposed += s._count.id;
    } else if (s.status === 'merged') {
      stats.merged += s._count.id;
    }
  });

  return { stats, recentIssues, flows };
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  href?: string;
}) {
  const content = (
    <div
      className={`
      bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6
      hover:shadow-lg dark:shadow-gray-900/50 hover:border-gray-300 dark:hover:border-gray-600 transition-all
      ${href ? 'cursor-pointer' : ''}
    `}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusColors: Record<string, string> = {
  new: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  triage: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  'in-progress': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  proposed: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  merged: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  rejected: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  'merged-duplicate': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
};

const statusLabels: Record<string, string> = {
  new: '起票',
  triage: 'トリアージ',
  'in-progress': '作業中',
  proposed: '提案済',
  merged: '完了',
  rejected: '却下',
  'merged-duplicate': '重複',
};

/**
 * はじめてガイド - チェックリストコンポーネント
 */
function GettingStartedChecklist({
  hasFlows,
  hasIssues,
  hasInProgress,
  hasProposed,
  hasMerged,
}: {
  hasFlows: boolean;
  hasIssues: boolean;
  hasInProgress: boolean;
  hasProposed: boolean;
  hasMerged: boolean;
}) {
  const steps = [
    {
      done: hasFlows,
      label: 'フローを確認する',
      description: '登録されている業務フローをダイアグラムで確認しましょう',
      href: '/flows',
      icon: Eye,
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30',
    },
    {
      done: hasIssues,
      label: '課題を報告する',
      description: '改善したい点や課題を記録します',
      href: '/issues/new',
      icon: Plus,
      color: 'text-red-600 bg-red-50 dark:bg-red-900/30',
    },
    {
      done: hasInProgress,
      label: '改善を始める',
      description: '課題の詳細画面で「改善を始める」を押すと作業スペースが準備されます',
      href: hasIssues ? '/issues' : undefined,
      icon: Play,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30',
    },
    {
      done: hasProposed,
      label: 'AIで改善案を生成する',
      description: 'AIがフロー定義の改善案を自動で作成します',
      href: hasInProgress ? '/issues' : undefined,
      icon: Sparkles,
      color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30',
    },
    {
      done: hasMerged,
      label: '変更を確定して完了する',
      description: '改善案を確定して完了です',
      href: hasProposed ? '/issues' : undefined,
      icon: GitMerge,
      color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;

  if (allDone) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              はじめてガイド
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              FlowOpsの基本的な流れを体験してみましょう
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / steps.length) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {completedCount}/{steps.length}
            </span>
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-gray-700">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isNext = !step.done && (i === 0 || steps[i - 1].done);
          return (
            <div
              key={i}
              className={`px-6 py-4 flex items-center gap-4 transition-colors ${
                isNext ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''
              } ${step.done ? 'opacity-60' : ''}`}
            >
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  step.done
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : step.color
                }`}
              >
                {step.done ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${step.done ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}
                >
                  {step.label}
                  {isNext && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      次のステップ
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {step.description}
                </p>
              </div>

              {!step.done && step.href && (
                <Link
                  href={step.href}
                  className="flex-shrink-0 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  開く
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ワークフロー概要図
 */
function WorkflowOverview() {
  const steps = [
    { icon: Eye, label: 'フロー確認', color: 'bg-indigo-500', description: '業務フローを可視化' },
    { icon: AlertCircle, label: '課題報告', color: 'bg-red-500', description: '課題を記録' },
    { icon: Play, label: '改善開始', color: 'bg-blue-500', description: '作業準備' },
    { icon: Sparkles, label: 'AI提案', color: 'bg-purple-500', description: '改善案を生成' },
    { icon: GitMerge, label: '確定', color: 'bg-green-500', description: '変更を確定' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
        FlowOps ワークフロー
      </h3>
      <div className="flex items-center justify-between gap-1">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={`w-10 h-10 ${step.color} rounded-xl flex items-center justify-center`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {step.label}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{step.description}</span>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mb-8" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const { stats, recentIssues, flows } = await getDashboardStats();

  const hasFlows = flows.length > 0;
  const hasIssues = stats.total > 0;
  const hasInProgress = stats.inProgress > 0 || stats.proposed > 0 || stats.merged > 0;
  const hasProposed = stats.proposed > 0 || stats.merged > 0;
  const hasMerged = stats.merged > 0;
  const isNewUser = !hasFlows && !hasIssues;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">ダッシュボード</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">FlowOps プロジェクトの概要</p>
      </div>

      {/* はじめてガイド（チェックリスト） */}
      <GettingStartedChecklist
        hasFlows={hasFlows}
        hasIssues={hasIssues}
        hasInProgress={hasInProgress}
        hasProposed={hasProposed}
        hasMerged={hasMerged}
      />

      {/* やることリスト */}
      <TaskQueue
        recentIssues={recentIssues.map(i => ({
          id: i.id,
          humanId: i.humanId,
          title: i.title,
          status: i.status,
        }))}
        stats={{ open: stats.open, inProgress: stats.inProgress, proposed: stats.proposed }}
      />

      {/* ワークフロー概要図 - 新規ユーザーの場合に表示 */}
      {isNewUser && <WorkflowOverview />}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="未対応の課題"
          value={stats.open}
          icon={AlertCircle}
          color="bg-red-500"
          href="/issues?status=open"
        />
        <StatCard
          title="作業中"
          value={stats.inProgress}
          icon={Clock}
          color="bg-blue-500"
          href="/issues?status=in-progress"
        />
        <StatCard
          title="改善案あり"
          value={stats.proposed}
          icon={GitBranch}
          color="bg-yellow-500"
          href="/issues?status=proposed"
        />
        <StatCard title="完了" value={stats.merged} icon={CheckCircle} color="bg-green-500" />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Issues */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">最近の課題</h2>
            <Link
              href="/issues"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              すべて表示 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentIssues.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">まだ課題がありません</p>
                <Link
                  href="/issues/new"
                  className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-block"
                >
                  最初の課題を報告する
                </Link>
              </div>
            ) : (
              recentIssues.map(issue => (
                <Link
                  key={issue.id}
                  href={`/issues/${issue.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                        {issue.humanId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[issue.status]}`}
                      >
                        {statusLabels[issue.status] || issue.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(issue.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 truncate">
                    {issue.title}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Flows */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">フロー</h2>
            <Link
              href="/flows"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              すべて表示 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {flows.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">まだフローがありません</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                    spec/flows/
                  </code>{' '}
                  にYAMLファイルを追加してください
                </p>
              </div>
            ) : (
              flows.slice(0, 5).map(flow => (
                <Link
                  key={flow.id}
                  href={`/flows/${flow.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {flow.title}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{flow.layer}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {flow.nodeCount} ノード / {flow.edgeCount} エッジ
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">フローを改善しませんか？</h2>
            <p className="mt-1 text-blue-100">課題を報告して、改善の追跡を始めましょう</p>
          </div>
          <Link
            href="/issues/new"
            className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
          >
            課題を報告する
          </Link>
        </div>
      </div>
    </div>
  );
}
