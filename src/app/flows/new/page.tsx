/**
 * FlowOps - New Flow Page
 *
 * GUIだけでフローを新規作成する画面（P1-6）
 */

import { listFlows } from '@/lib/flow-service';
import { NewFlowForm } from './NewFlowForm';

export const metadata = {
  title: '新しいフローを作る - FlowOps',
  description: 'テンプレートから業務フローを作成します',
};

export default async function NewFlowPage() {
  const flows = await listFlows();

  return (
    <div className="p-6">
      <NewFlowForm existingIds={flows.map(f => f.id)} />
    </div>
  );
}
