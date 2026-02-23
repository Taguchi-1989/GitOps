/**
 * FlowOps - Issues List Client Component
 */

'use client';

import { useRouter } from 'next/navigation';
import { IssueList, IssueCardData } from '@/components/issue';

interface IssuesListClientProps {
  initialIssues: IssueCardData[];
}

export function IssuesListClient({ initialIssues }: IssuesListClientProps) {
  const router = useRouter();

  const handleCreateClick = () => {
    router.push('/issues/new');
  };

  return <IssueList issues={initialIssues} onCreateClick={handleCreateClick} />;
}
