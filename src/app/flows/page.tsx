/**
 * FlowOps - Flows List Page
 *
 * フロー一覧ページ
 */

import { listFlows } from '@/lib/flow-service';
import { FlowList } from '@/components/flow';

export const metadata = {
  title: 'Flows - FlowOps',
  description: 'YAMLフロー定義の一覧',
};

export default async function FlowsPage() {
  const flows = await listFlows();

  return (
    <div className="fo-workbench">
      <FlowList flows={flows} />
    </div>
  );
}
