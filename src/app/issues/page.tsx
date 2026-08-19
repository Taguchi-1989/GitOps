/**
 * FlowOps - Issues List Page
 *
 * 改善カード一覧ページ
 */

import { prisma } from '@/lib/prisma';
import { IssuesListClient } from './IssuesListClient';
import { IssueStatus } from '@/core/issue';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '改善カード - FlowOps',
  description: '改善カード一覧',
};

async function getIssues() {
  const issues = await prisma.issue.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { proposals: true },
      },
    },
  });

  return issues.map(issue => ({
    id: issue.id,
    humanId: issue.humanId,
    title: issue.title,
    description: issue.description,
    status: issue.status as IssueStatus,
    targetFlowId: issue.targetFlowId,
    targetNodeId: issue.targetNodeId,
    branchName: issue.branchName,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    // 一覧でも「完了（標準化済み）」を判別できるようにする
    standardizedAt: issue.standardizedAt,
  }));
}

export default async function IssuesPage() {
  const issues = await getIssues();

  return (
    <div className="p-6">
      <IssuesListClient initialIssues={issues} />
    </div>
  );
}
