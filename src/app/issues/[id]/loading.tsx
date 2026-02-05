/**
 * FlowOps - Loading State
 */

import { Spinner } from '@/components/ui/Spinner';

export default function Loading() {
  return (
    <div className="h-[calc(100vh-100px)] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
