/**
 * FlowOps - Flow Viewer Client Component
 *
 * クライアントサイドのフロービューワー
 */

'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { FlowViewer } from '@/components/flow';
import { Flow } from '@/core/parser';

interface FlowViewerClientProps {
  flow: Flow;
  mermaidContent: string;
  yamlContent?: string;
}

export function FlowViewerClient({ flow, mermaidContent, yamlContent }: FlowViewerClientProps) {
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSave = useCallback(
    async (content: string, flowId: string) => {
      const res = await fetch('/api/flows/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, flowId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `保存失敗 (HTTP ${res.status})`);
      }

      showToast('フローを保存しました', 'success');
      router.refresh();
    },
    [showToast, router]
  );

  return (
    <div className="relative h-full">
      <FlowViewer
        flow={flow}
        mermaidContent={mermaidContent}
        yamlContent={yamlContent}
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
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}
    </div>
  );
}
