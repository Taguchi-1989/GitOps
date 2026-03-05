/**
 * FlowOps - Issue Detail Client Component
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IssueDetail, IssueCardData, ProposalData } from '@/components/issue';
import { useToast } from '@/components/ui/Toast';
import { getFriendlyError, formatFriendlyToast } from '@/lib/friendly-errors';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'merge' | 'reject' | 'apply';
    proposalId?: string;
  } | null>(null);

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
        const friendly = getFriendlyError(data.errorCode, data.details);
        addToast(friendly.severity, formatFriendlyToast(friendly));
        return;
      }

      addToast('success', '改善の作業を開始しました');
      router.refresh();
    } catch {
      addToast('error', '作業の開始に失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateProposal = async () => {
    if (!issue.targetFlowId) {
      addToast('error', '対象フローを設定してから改善案を生成してください。');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/proposals/generate`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!data.ok) {
        const friendly = getFriendlyError(data.errorCode, data.details);
        addToast(friendly.severity, formatFriendlyToast(friendly));
        return;
      }

      addToast('success', 'AIが改善案を作成しました');
      router.refresh();
    } catch {
      addToast('error', '改善案の生成に失敗しました。もう一度お試しください。');
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
        const friendly = getFriendlyError(data.errorCode, data.details);
        addToast(friendly.severity, formatFriendlyToast(friendly));
        return;
      }

      addToast('success', '改善案を反映しました');
      router.refresh();
    } catch {
      addToast('error', '改善案の反映に失敗しました。もう一度お試しください。');
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
        const friendly = getFriendlyError(data.errorCode, data.details);
        addToast(friendly.severity, formatFriendlyToast(friendly));
        return;
      }

      addToast('success', '変更を確定しました');
      router.refresh();
    } catch {
      addToast('error', '変更の確定に失敗しました。もう一度お試しください。');
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
        const friendly = getFriendlyError(data.errorCode, data.details);
        addToast(friendly.severity, formatFriendlyToast(friendly));
        return;
      }

      addToast('success', 'この課題を見送りにしました');
      router.refresh();
    } catch {
      addToast('error', '操作に失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDialogConfig = {
    merge: {
      title: '変更を確定しますか？',
      description: 'この操作により改善内容が正式に反映されます。',
      whatHappens: ['改善内容が正式なフローに反映されます', 'この課題は「完了」になります'],
      confirmLabel: '変更を確定する',
      confirmColor: 'green' as const,
      onConfirm: handleMergeClose,
    },
    reject: {
      title: 'この課題を見送りますか？',
      description: 'この操作により課題が見送り（却下）になります。',
      whatHappens: [
        '改善案は反映されません',
        'この課題は「見送り」になります',
        '必要に応じて新しい課題を報告できます',
      ],
      confirmLabel: '見送りにする',
      confirmColor: 'red' as const,
      onConfirm: handleReject,
    },
    apply: {
      title: '改善案を反映しますか？',
      description: 'AIが提案した改善内容をフローに適用します。',
      whatHappens: [
        'AIの提案内容がフローに適用されます',
        '適用後に「変更を確定」または「見送り」を選べます',
      ],
      confirmLabel: '反映する',
      confirmColor: 'green' as const,
      onConfirm: () => {
        if (confirmDialog?.proposalId) {
          handleApplyProposal(confirmDialog.proposalId);
        }
      },
    },
  };

  const currentConfig = confirmDialog ? confirmDialogConfig[confirmDialog.type] : null;

  return (
    <>
      <IssueDetail
        issue={issue}
        onBack={handleBack}
        onStart={handleStart}
        onGenerateProposal={handleGenerateProposal}
        onApplyProposal={proposalId => setConfirmDialog({ type: 'apply', proposalId })}
        onMergeClose={() => setConfirmDialog({ type: 'merge' })}
        onReject={() => setConfirmDialog({ type: 'reject' })}
        isLoading={isLoading}
      />

      {currentConfig && (
        <ConfirmDialog
          isOpen={!!confirmDialog}
          onConfirm={() => {
            currentConfig.onConfirm();
            setConfirmDialog(null);
          }}
          onCancel={() => setConfirmDialog(null)}
          title={currentConfig.title}
          description={currentConfig.description}
          whatHappens={currentConfig.whatHappens}
          confirmLabel={currentConfig.confirmLabel}
          confirmColor={currentConfig.confirmColor}
          isLoading={isLoading}
        />
      )}
    </>
  );
}
