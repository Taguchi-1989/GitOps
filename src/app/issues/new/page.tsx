/**
 * FlowOps - New Issue Page
 * 
 * Issue作成ページ
 */

import { listFlows } from '@/lib/flow-service';
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

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Issue</h1>
      <NewIssueForm
        flows={flows}
        defaultFlowId={searchParams.targetFlowId}
        defaultNodeId={searchParams.targetNodeId}
      />
    </div>
  );
}
