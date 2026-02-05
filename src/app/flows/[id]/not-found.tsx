/**
 * FlowOps - Flow Not Found Page
 */

import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function FlowNotFound() {
  return (
    <div className="h-[calc(100vh-100px)] flex items-center justify-center">
      <div className="text-center">
        <FileQuestion className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Flow Not Found</h1>
        <p className="text-gray-500 mb-6">
          The flow you're looking for doesn't exist or has been removed.
        </p>
        <Link
          href="/flows"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Flows
        </Link>
      </div>
    </div>
  );
}
