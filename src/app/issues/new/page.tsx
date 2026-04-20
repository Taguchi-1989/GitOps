/**
 * FlowOps - New Issue Page
 *
 * Issue作成ページ
 */

import { listFlows, getFlow } from '@/lib/flow-service';
import { NewIssueForm } from './NewIssueForm';

export const metadata = {
  title: 'New Issue - FlowOps',
  description: '新しいIssueを作成',
};

interface PageProps {
  searchParams: {
    targetFlowId?: string;
    targetNodeId?: string;
  };
}

export default async function NewIssuePage({ searchParams }: PageProps) {
  const flows = await listFlows();

  // SSR側で全フローのFlowデータを取得（APIを経由せず直接ファイル読み込み）
  const flowsMap: Record<string, import('@/core/parser/schema').Flow> = {};
  for (const f of flows) {
    const flowData = await getFlow(f.id);
    if (flowData?.flow) {
      flowsMap[f.id] = flowData.flow;
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <NewIssueForm
        flows={flows}
        flowsMap={flowsMap}
        defaultFlowId={searchParams.targetFlowId}
        defaultNodeId={searchParams.targetNodeId}
      />
    </div>
  );
}
