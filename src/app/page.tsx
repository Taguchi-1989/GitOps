/**
 * FlowOps - Dashboard Page
 *
 * ホームページ / ダッシュボード
 * - はじめてガイド（チェックリスト）
 * - 統計カード
 * - ワークフロー概要図
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { listFlows } from '@/lib/flow-service';
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
      bg-white rounded-xl border border-gray-200 p-6
      hover:shadow-lg hover:border-gray-300 transition-all
      ${href ? 'cursor-pointer' : ''}
    `}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
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
  new: 'bg-red-100 text-red-700',
  triage: 'bg-orange-100 text-orange-700',
  'in-progress': 'bg-blue-100 text-blue-700',
  proposed: 'bg-yellow-100 text-yellow-700',
  merged: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-700',
  'merged-duplicate': 'bg-purple-100 text-purple-700',
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
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      done: hasIssues,
      label: 'Issueを作成する',
      description: '改善したい点や課題をIssueとして記録します',
      href: '/issues/new',
      icon: Plus,
      color: 'text-red-600 bg-red-50',
    },
    {
      done: hasInProgress,
      label: '作業を開始する',
      description: 'Issue詳細画面で「作業を開始」を押すとGitブランチが作成されます',
      href: hasIssues ? '/issues' : undefined,
      icon: Play,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      done: hasProposed,
      label: 'AIで改善案を生成する',
      description: 'AIがフロー定義の改善案を自動で作成します',
      href: hasInProgress ? '/issues' : undefined,
      icon: Sparkles,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      done: hasMerged,
      label: 'マージして完了する',
      description: '改善案をメインブランチに統合して完了です',
      href: hasProposed ? '/issues' : undefined,
      icon: GitMerge,
      color: 'text-green-600 bg-green-50',
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;

  if (allDone) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">はじめてガイド</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              FlowOpsの基本的な流れを体験してみましょう
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / steps.length) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-500 font-medium">
              {completedCount}/{steps.length}
            </span>
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-50">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isNext = !step.done && (i === 0 || steps[i - 1].done);
          return (
            <div
              key={i}
              className={`px-6 py-4 flex items-center gap-4 transition-colors ${
                isNext ? 'bg-blue-50/30' : ''
              } ${step.done ? 'opacity-60' : ''}`}
            >
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  step.done ? 'bg-green-100 text-green-600' : step.color
                }`}
              >
                {step.done ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${step.done ? 'text-gray-500 line-through' : 'text-gray-900'}`}
                >
                  {step.label}
                  {isNext && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      次のステップ
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
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
    { icon: AlertCircle, label: 'Issue作成', color: 'bg-red-500', description: '課題を記録' },
    { icon: Play, label: '作業開始', color: 'bg-blue-500', description: 'ブランチ作成' },
    { icon: Sparkles, label: 'AI提案', color: 'bg-purple-500', description: '改善案を生成' },
    { icon: GitMerge, label: 'マージ', color: 'bg-green-500', description: '変更を統合' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-4">FlowOps ワークフロー</h3>
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
                <span className="text-xs font-medium text-gray-700">{step.label}</span>
                <span className="text-xs text-gray-400">{step.description}</span>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0 mb-8" />
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
        <h1 className="text-3xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="mt-1 text-gray-500">FlowOps プロジェクトの概要</p>
      </div>

      {/* はじめてガイド（チェックリスト） */}
      <GettingStartedChecklist
        hasFlows={hasFlows}
        hasIssues={hasIssues}
        hasInProgress={hasInProgress}
        hasProposed={hasProposed}
        hasMerged={hasMerged}
      />

      {/* ワークフロー概要図 - 新規ユーザーの場合に表示 */}
      {isNewUser && <WorkflowOverview />}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="未対応のIssue"
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
          title="提案済"
          value={stats.proposed}
          icon={GitBranch}
          color="bg-yellow-500"
          href="/issues?status=proposed"
        />
        <StatCard
          title="完了（マージ済）"
          value={stats.merged}
          icon={CheckCircle}
          color="bg-green-500"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Issues */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">最近のIssue</h2>
            <Link
              href="/issues"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              すべて表示 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentIssues.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-gray-500">まだIssueがありません</p>
                <Link
                  href="/issues/new"
                  className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-block"
                >
                  最初のIssueを作成する
                </Link>
              </div>
            ) : (
              recentIssues.map(issue => (
                <Link
                  key={issue.id}
                  href={`/issues/${issue.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-gray-500">{issue.humanId}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[issue.status]}`}
                      >
                        {statusLabels[issue.status] || issue.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(issue.updatedAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-900 truncate">{issue.title}</p>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Flows */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">フロー</h2>
            <Link
              href="/flows"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              すべて表示 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {flows.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-gray-500">まだフローがありません</p>
                <p className="text-xs text-gray-400 mt-1">
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded">spec/flows/</code>{' '}
                  にYAMLファイルを追加してください
                </p>
              </div>
            ) : (
              flows.slice(0, 5).map(flow => (
                <Link
                  key={flow.id}
                  href={`/flows/${flow.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{flow.title}</span>
                    </div>
                    <span className="text-xs text-gray-400">{flow.layer}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
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
            <p className="mt-1 text-blue-100">Issueを作成して、改善の追跡を始めましょう</p>
          </div>
          <Link
            href="/issues/new"
            className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
          >
            Issueを作成
          </Link>
        </div>
      </div>
    </div>
  );
}
