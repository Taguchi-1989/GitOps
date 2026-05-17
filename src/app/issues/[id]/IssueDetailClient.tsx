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
    type: 'merge' | 'reject' | 'apply' | 'returnToProgress';
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

  const postWithReason = async (
    url: string,
    reason: string | undefined,
    successMsg: string,
    failMsg: string
  ) => {
    setIsLoading(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!data.ok) {
        const friendly = getFriendlyError(data.errorCode, data.details);
        addToast(friendly.severity, formatFriendlyToast(friendly));
        return;
      }
      addToast('success', successMsg);
      router.refresh();
    } catch {
      addToast('error', failMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyProposal = (proposalId: string, reason?: string) =>
    postWithReason(
      `/api/proposals/${proposalId}/apply`,
      reason,
      '改善案を反映しました',
      '改善案の反映に失敗しました。もう一度お試しください。'
    );

  const handleMergeClose = (reason?: string) =>
    postWithReason(
      `/api/issues/${issue.id}/merge-close`,
      reason,
      '変更を確定しました',
      '変更の確定に失敗しました。もう一度お試しください。'
    );

  const handleReturnToProgress = (reason?: string) =>
    postWithReason(
      `/api/issues/${issue.id}/return-to-progress`,
      reason,
      '提案を差戻しました。再度AIで改善案を作り直してください。',
      '差戻しに失敗しました。'
    );

  const handleReject = async (reason?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', reason }),
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
      reason: 'required' as const,
      reasonLabel: '確定の理由',
      reasonPlaceholder: '例: 関係部門と合意済。リスクは限定的なため確定。',
      onConfirm: (reason?: string) => handleMergeClose(reason),
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
      reason: 'required' as const,
      reasonLabel: '見送りの理由',
      reasonPlaceholder: '例: 現状の運用で十分対応可能なため',
      onConfirm: (reason?: string) => handleReject(reason),
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
      reason: 'optional' as const,
      reasonLabel: 'メモ',
      reasonPlaceholder: 'AI提案を採用する根拠など',
      onConfirm: (reason?: string) => {
        if (confirmDialog?.proposalId) {
          handleApplyProposal(confirmDialog.proposalId, reason);
        }
      },
    },
    returnToProgress: {
      title: '提案を差戻しますか？',
      description: '提案者(SE)に「練り直し」を依頼し、課題を作業中に戻します。',
      whatHappens: [
        '課題のステータスが「作業中」に戻ります',
        '差戻し理由は監査ログに残ります',
        'SEはAIで改善案を再生成できます',
      ],
      confirmLabel: '差戻しを依頼',
      confirmColor: 'red' as const,
      reason: 'required' as const,
      reasonLabel: '差戻し理由',
      reasonPlaceholder: '例: 関係部門との合意が不十分。〇〇の観点を追加検討してほしい',
      onConfirm: (reason?: string) => handleReturnToProgress(reason),
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
        onReturnToProgress={() => setConfirmDialog({ type: 'returnToProgress' })}
        isLoading={isLoading}
      />

      {currentConfig && (
        <ConfirmDialog
          isOpen={!!confirmDialog}
          onConfirm={reason => {
            currentConfig.onConfirm(reason);
            setConfirmDialog(null);
          }}
          onCancel={() => setConfirmDialog(null)}
          title={currentConfig.title}
          description={currentConfig.description}
          whatHappens={currentConfig.whatHappens}
          confirmLabel={currentConfig.confirmLabel}
          confirmColor={currentConfig.confirmColor}
          reason={currentConfig.reason}
          reasonLabel={currentConfig.reasonLabel}
          reasonPlaceholder={currentConfig.reasonPlaceholder}
          isLoading={isLoading}
        />
      )}
    </>
  );
}
