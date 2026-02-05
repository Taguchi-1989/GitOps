/**
 * FlowOps - Flow Detail Page
 * 
 * フロー詳細ページ
 */

import { notFound } from 'next/navigation';
import { getFlow } from '@/lib/flow-service';
import { FlowViewerClient } from './FlowViewerClient';

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps) {
  const flowData = await getFlow(params.id);
  
  if (!flowData) {
    return { title: 'Flow Not Found - FlowOps' };
  }

  return {
    title: `${flowData.flow.title} - FlowOps`,
    description: `${flowData.flow.layer} フロー: ${flowData.flow.title}`,
  };
}

export default async function FlowDetailPage({ params }: PageProps) {
  const flowData = await getFlow(params.id);

  if (!flowData) {
    notFound();
  }

  return (
    <div className="h-[calc(100vh-0px)]">
      <FlowViewerClient
        flow={flowData.flow}
        mermaidContent={flowData.mermaid}
      />
    </div>
  );
}
