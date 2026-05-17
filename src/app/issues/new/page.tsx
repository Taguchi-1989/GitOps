import { listFlows } from '@/lib/flow-service';
import { NewIssueForm } from './NewIssueForm';
import { IssueKindSchema } from '@/core/issue';

export const metadata = {
  title: '新規作成 - FlowOps',
};

interface PageProps {
  searchParams: Promise<{
    targetFlowId?: string;
    targetNodeId?: string;
    kind?: string;
  }>;
}

export default async function NewIssuePage({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const flows = await listFlows();
  const kind = IssueKindSchema.safeParse(resolved.kind).success
    ? (resolved.kind as 'problem' | 'praise')
    : 'problem';

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <NewIssueForm
        flows={flows}
        defaultFlowId={resolved.targetFlowId}
        defaultNodeId={resolved.targetNodeId}
        kind={kind}
      />
    </div>
  );
}
