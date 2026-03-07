/**
 * FlowOps - Flow Detail Page
 *
 * フロー詳細ページ
 */

import { notFound } from 'next/navigation';
import { getFlow, getFlowYaml } from '@/lib/flow-service';
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

  const yamlContent = await getFlowYaml(params.id);

  return (
    <div className="h-[calc(100vh-0px)]">
      <FlowViewerClient
        flow={flowData.flow}
        mermaidContent={flowData.mermaid}
        yamlContent={yamlContent || undefined}
      />
    </div>
  );
}
