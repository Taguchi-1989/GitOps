/**
 * FlowOps - Issue Detail Page
 *
 * Issue詳細ページ
 */

export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { IssueDetailClient } from './IssueDetailClient';
import { IssueStatus } from '@/core/issue';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

async function getIssue(id: string) {
  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      proposals: {
        orderBy: { createdAt: 'desc' },
      },
      duplicates: {
        select: { id: true, humanId: true, title: true, status: true },
      },
      canonicalIssue: {
        select: { id: true, humanId: true, title: true, status: true },
      },
    },
  });

  if (!issue) return null;

  return {
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
    proposals: issue.proposals.map(p => ({
      id: p.id,
      intent: p.intent,
      jsonPatch: p.jsonPatch,
      diffPreview: p.diffPreview,
      isApplied: p.isApplied,
      appliedAt: p.appliedAt,
      createdAt: p.createdAt,
      baseHash: p.baseHash,
    })),
    duplicates: issue.duplicates,
    canonicalIssue: issue.canonicalIssue,
  };
}

export async function generateMetadata({ params }: PageProps) {
  const issue = await getIssue(params.id);

  if (!issue) {
    return { title: 'Issue Not Found - FlowOps' };
  }

  return {
    title: `${issue.humanId}: ${issue.title} - FlowOps`,
    description: issue.description.substring(0, 160),
  };
}

export default async function IssueDetailPage({ params }: PageProps) {
  const issue = await getIssue(params.id);

  if (!issue) {
    notFound();
  }

  return (
    <div className="p-6">
      <IssueDetailClient issue={issue} />
    </div>
  );
}
