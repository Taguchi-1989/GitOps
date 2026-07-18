import { BpmnWorkbenchClient } from './BpmnWorkbenchClient';

export const metadata = {
  title: 'BPMN交換 - FlowOps',
  description: '正規化JSON・Mermaid・BPMN 2.0 XMLの相互変換',
};

export default function BpmnWorkbenchPage() {
  return (
    <div className="p-6">
      <BpmnWorkbenchClient />
    </div>
  );
}
