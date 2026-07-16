import { DexpiWorkbenchClient } from './DexpiWorkbenchClient';

export const metadata = {
  title: 'DeXPI交換 - FlowOps',
  description: '正規化JSON・Mermaid・DeXPI XML 2.0の相互変換',
};

export default function DexpiWorkbenchPage() {
  return (
    <div className="p-6">
      <DexpiWorkbenchClient />
    </div>
  );
}
