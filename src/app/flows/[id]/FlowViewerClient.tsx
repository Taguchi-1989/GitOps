/**
 * FlowOps - Flow Viewer Client Component
 * 
 * クライアントサイドのフロービューワー
 */

'use client';

import { useRouter } from 'next/navigation';
import { FlowViewer } from '@/components/flow';
import { Flow } from '@/core/parser';

interface FlowViewerClientProps {
  flow: Flow;
  mermaidContent: string;
}

export function FlowViewerClient({ flow, mermaidContent }: FlowViewerClientProps) {
  const router = useRouter();

  const handleBack = () => {
    router.push('/flows');
  };

  const handleNodeClick = (nodeId: string) => {
    console.log('Node clicked:', nodeId);
  };

  const handleCreateIssue = (nodeId?: string) => {
    const params = new URLSearchParams();
    params.set('targetFlowId', flow.id);
    if (nodeId) {
      params.set('targetNodeId', nodeId);
    }
    router.push(`/issues/new?${params.toString()}`);
  };

  return (
    <FlowViewer
      flow={flow}
      mermaidContent={mermaidContent}
      onBack={handleBack}
      onNodeClick={handleNodeClick}
      onCreateIssue={handleCreateIssue}
    />
  );
}
