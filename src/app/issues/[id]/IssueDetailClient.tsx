/**
 * FlowOps - Issue Detail Client Component
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IssueDetail, IssueCardData, ProposalData } from '@/components/issue';
import { useToast } from '@/components/ui/Toast';

interface IssueDetailClientProps {
  issue: IssueCardData & {
    proposals: ProposalData[];
    duplicates?: { id: string; humanId: string; title: string; status: string }[];
    canonicalIssue?: { id: string; humanId: string; title: string; status: string } | null;
  };
}

export function IssueDetailClient({ issue }: IssueDetailClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleBack = () => {
    router.push('/issues');
  };

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/start`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.details || 'Failed to start issue');
      }

      addToast('success', `Work started. Branch: ${data.data.branchName}`);
      router.refresh();
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to start issue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateProposal = async () => {
    if (!issue.targetFlowId) {
      addToast('error', 'Please set a target flow before generating a proposal');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/proposals/generate`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.details || 'Failed to generate proposal');
      }

      addToast('success', 'Proposal generated successfully');
      router.refresh();
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to generate proposal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyProposal = async (proposalId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/apply`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.details || 'Failed to apply proposal');
      }

      addToast('success', 'Proposal applied and committed');
      router.refresh();
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to apply proposal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMergeClose = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/merge-close`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.details || 'Failed to merge and close');
      }

      addToast('success', 'Issue merged and closed');
      router.refresh();
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to merge and close');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.details || 'Failed to reject issue');
      }

      addToast('success', 'Issue rejected');
      router.refresh();
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to reject issue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <IssueDetail
      issue={issue}
      onBack={handleBack}
      onStart={handleStart}
      onGenerateProposal={handleGenerateProposal}
      onApplyProposal={handleApplyProposal}
      onMergeClose={handleMergeClose}
      onReject={handleReject}
      isLoading={isLoading}
    />
  );
}
