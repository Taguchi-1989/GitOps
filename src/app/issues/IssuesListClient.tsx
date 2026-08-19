/**
 * FlowOps - Issues List Client Component
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { IssueList, IssueCardData } from '@/components/issue';
import { ISSUE_TAB_CONFIG, type IssueTabValue } from '@/lib/issue-status-ui';

interface IssuesListClientProps {
  initialIssues: IssueCardData[];
}

/** ダッシュボードの統計カードからの ?tab=open|checking|closed を初期タブにする */
function parseTab(value: string | null): IssueTabValue {
  return value && value in ISSUE_TAB_CONFIG ? (value as IssueTabValue) : 'open';
}

export function IssuesListClient({ initialIssues }: IssuesListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = parseTab(searchParams.get('tab'));

  const handleCreateClick = () => {
    router.push('/issues/new');
  };

  return (
    <IssueList
      // ?tab= が変わったらタブ選択をやり直す（同一ページ内の遷移でも初期値を反映）
      key={initialTab}
      issues={initialIssues}
      initialTab={initialTab}
      onCreateClick={handleCreateClick}
    />
  );
}
