/**
 * FlowOps - Dashboard Page
 * 
 * ホームページ / ダッシュボード
 */

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
  TrendingUp,
} from 'lucide-react';

async function getDashboardStats() {
  const [issueStats, recentIssues, flows] = await Promise.all([
    // Issue統計
    prisma.issue.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    // 最近のIssue
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
    // フロー一覧
    listFlows(),
  ]);

  // 統計を整形
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
    <div className={`
      bg-white rounded-xl border border-gray-200 p-6
      hover:shadow-lg hover:border-gray-300 transition-all
      ${href ? 'cursor-pointer' : ''}
    `}>
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

export default async function DashboardPage() {
  const { stats, recentIssues, flows } = await getDashboardStats();

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-500">FlowOps プロジェクトの概要</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Open Issues"
          value={stats.open}
          icon={AlertCircle}
          color="bg-red-500"
          href="/issues?status=open"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={Clock}
          color="bg-blue-500"
          href="/issues?status=in-progress"
        />
        <StatCard
          title="Proposed"
          value={stats.proposed}
          icon={GitBranch}
          color="bg-yellow-500"
          href="/issues?status=proposed"
        />
        <StatCard
          title="Merged"
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
            <h2 className="text-lg font-semibold text-gray-900">Recent Issues</h2>
            <Link 
              href="/issues" 
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentIssues.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No issues yet
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
                      <span className="text-sm font-mono text-gray-500">
                        {issue.humanId}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[issue.status]}`}>
                        {issue.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDate(issue.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-900 truncate">
                    {issue.title}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Flows */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Flows</h2>
            <Link 
              href="/flows" 
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {flows.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No flows yet</p>
                <p className="text-xs mt-1">Add YAML files to spec/flows/</p>
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
                      <span className="text-sm font-medium text-gray-900">
                        {flow.title}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {flow.layer}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {flow.nodeCount} nodes · {flow.edgeCount} edges
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
            <h2 className="text-xl font-semibold">Ready to improve your flows?</h2>
            <p className="mt-1 text-blue-100">Create an issue to start tracking changes</p>
          </div>
          <Link
            href="/issues/new"
            className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
          >
            Create Issue
          </Link>
        </div>
      </div>
    </div>
  );
}
