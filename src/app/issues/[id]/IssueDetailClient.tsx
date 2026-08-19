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
    type: 'merge' | 'reject' | 'apply' | 'closeIneffective';
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

  /** ステータスを終端状態へ更新する（見送り / 効果なし完了） */
  const updateStatus = async (
    status: 'rejected' | 'closed-ineffective',
    successMessage: string
  ) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      if (!data.ok) {
        const friendly = getFriendlyError(data.errorCode, data.details);
        addToast(friendly.severity, formatFriendlyToast(friendly));
        return;
      }

      addToast('success', successMessage);
      router.refresh();
    } catch {
      addToast('error', '操作に失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = () => updateStatus('rejected', 'この改善カードを見送りにしました');

  const handleCloseIneffective = () =>
    updateStatus('closed-ineffective', '見送り（効果なし）として完了しました');

  const confirmDialogConfig = {
    merge: {
      title: '変更を確定しますか？',
      description: 'この操作により改善内容が正式に反映されます。',
      whatHappens: [
        '改善内容が正式なフローに反映されます',
        'この改善カードは「効果確認中」になります',
      ],
      confirmLabel: '変更を確定する',
      confirmColor: 'green' as const,
      onConfirm: handleMergeClose,
    },
    reject: {
      title: 'この改善カードを見送りますか？',
      description: 'この操作により改善カードが見送りになります。',
      whatHappens: [
        'この改善カードは「見送り」になります',
        'これまでに記録した内容（Plan / Check）は残ります',
        '必要に応じて新しい改善カードを作成できます',
      ],
      confirmLabel: '見送りにする',
      confirmColor: 'red' as const,
      onConfirm: handleReject,
    },
    closeIneffective: {
      title: '見送り（効果なし）として完了しますか？',
      description: 'フローに反映しましたが効果が確認できなかった、として完了します。',
      whatHappens: [
        'この改善カードは「見送り（効果なし）」になります',
        '効果確認（Check）の記録と学びは残ります',
        '別のアプローチで新しい改善カードを作成できます',
      ],
      confirmLabel: '見送りとして完了する',
      confirmColor: 'red' as const,
      onConfirm: handleCloseIneffective,
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
        onCloseIneffective={() => setConfirmDialog({ type: 'closeIneffective' })}
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
