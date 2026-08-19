/**
 * FlowOps - Flow Viewer Client Component
 *
 * クライアントサイドのフロービューワー
 */

'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { FlowViewer } from '@/components/flow';
import { useDisplayMode } from '@/lib/simple-mode-context';
import { Flow } from '@/core/parser';

interface ToastState {
  message: string;
  type: 'success' | 'error';
  /** 成功時に必ず示す行き先(作成された改善カードなど) */
  action?: { label: string; href: string };
}

/**
 * API の details を利用者向けメッセージにする。
 * グリッド編集(FlowGridEditor)と同じく、CellError[] の JSON が入る場合がある。
 */
function formatApiErrorDetails(details: unknown): string | undefined {
  if (typeof details !== 'string' || !details) return undefined;
  try {
    const parsed = JSON.parse(details);
    if (Array.isArray(parsed)) {
      const messages = parsed
        .map((e: { message?: string }) => e?.message)
        .filter((m): m is string => Boolean(m));
      if (messages.length > 0) return `入力に誤りがあります: ${messages.join(' / ')}`;
    }
  } catch {
    /* not JSON */
  }
  return details;
}

interface FlowViewerClientProps {
  flow: Flow;
  mermaidContent: string;
  yamlContent?: string;
  baseHash?: string;
}

export function FlowViewerClient({
  flow,
  mermaidContent,
  yamlContent,
  baseHash,
}: FlowViewerClientProps) {
  const router = useRouter();
  const { isTechMode } = useDisplayMode();
  const [toast, setToast] = useState<ToastState | null>(null);

  const handleBack = () => {
    router.push('/flows');
  };

  const handleNodeClick = (_nodeId: string) => {
    // ノード選択時のアクション（詳細パネル表示など）
  };

  const handleCreateIssue = (nodeId?: string) => {
    const params = new URLSearchParams();
    params.set('targetFlowId', flow.id);
    if (nodeId) {
      params.set('targetNodeId', nodeId);
    }
    router.push(`/issues/new?${params.toString()}`);
  };

  const showToast = useCallback((toastState: ToastState) => {
    setToast(toastState);
    // 行き先リンク付きのトーストはクリックできるよう長めに残す
    setTimeout(() => setToast(null), toastState.action ? 8000 : 3000);
  }, []);

  /**
   * キャンバス編集の保存。グリッド編集と同じ Proposal(改善案) 経由に統一し、
   * 確認なしの即時上書きは行わない。
   */
  const handleSave = useCallback(
    async (updatedFlow: Flow) => {
      if (!baseHash) {
        throw new Error('このフローは申請できません。ページを更新してからやり直してください');
      }

      const res = await fetch(`/api/flows/${encodeURIComponent(updatedFlow.id)}/grid-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow: updatedFlow,
          baseHash,
          intent: '図の編集によるフロー更新',
        }),
      });

      if (res.status === 409) {
        throw new Error(
          '他の人が先にこのフローを更新しました。ページを更新してもう一度編集してください'
        );
      }

      if (!res.ok) {
        // errorResponse() は { ok, errorCode, details } を返す(@/lib/api-utils)。
        // 検証エラーはセル単位の CellError[] が JSON 文字列で入ることがあるため、
        // その場合は件数だけを伝えてグリッド編集へ誘導する。
        const body = await res.json().catch(() => ({}));
        const details = (body as { details?: string }).details;
        throw new Error(
          formatApiErrorDetails(details) ??
            `申請に失敗しました${isTechMode ? ` (HTTP ${res.status})` : ''}`
        );
      }

      // 改善案は Issue(改善カード)に紐づく。承認待ち一覧(ApprovalRequest)には
      // 出ないので、作成された改善カードの詳細へ直接誘導する。
      const body = (await res.json().catch(() => null)) as { data?: { issueId?: string } } | null;
      const issueId = body?.data?.issueId;

      showToast({
        message: '改善案として登録しました。反映するには改善カードで操作してください。',
        type: 'success',
        action: issueId
          ? { label: '改善カードを開いて反映する', href: `/issues/${issueId}` }
          : { label: '改善カードの一覧を見る', href: '/issues' },
      });
      router.refresh();
    },
    [showToast, router, baseHash, isTechMode]
  );

  return (
    <div className="relative h-full">
      <FlowViewer
        flow={flow}
        mermaidContent={mermaidContent}
        yamlContent={yamlContent}
        baseHash={baseHash}
        onBack={handleBack}
        onNodeClick={handleNodeClick}
        onCreateIssue={handleCreateIssue}
        onSave={handleSave}
      />

      {/* Toast notification */}
      {toast && (
        <div
          className={`
            fixed bottom-6 right-6 z-50
            flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg
            text-sm font-medium text-white
            transition-all duration-300
            ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}
          `}
          role="alert"
        >
          <span>
            {toast.type === 'success' ? '✓' : '✕'} {toast.message}
          </span>
          {toast.action && (
            <button
              type="button"
              onClick={() => router.push(toast.action!.href)}
              className="ml-2 px-2 py-1 rounded bg-white/20 hover:bg-white/30 transition-colors underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
