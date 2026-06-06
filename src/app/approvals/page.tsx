/**
 * FlowOps - 承認待ち一覧ページ
 *
 * 承認待ち（pending）のApprovalRequestを一覧表示する。
 */

import { prisma } from '@/lib/prisma';
import { ApprovalsListClient } from './ApprovalsListClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '承認待ち - FlowOps',
  description: '承認待ち一覧',
};

async function getPendingApprovals() {
  const requests = await prisma.approvalRequest.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'desc' },
    include: { workflow: true },
  });

  return requests.map(r => ({
    id: r.id,
    workflowId: r.workflowId,
    nodeId: r.nodeId,
    description: r.description,
    createdAt: r.createdAt,
    flowId: r.workflow.flowId,
    workflowStatus: r.workflow.status,
  }));
}

export default async function ApprovalsPage() {
  const approvals = await getPendingApprovals();

  return (
    <div className="p-6">
      <ApprovalsListClient approvals={approvals} />
    </div>
  );
}
