/**
 * FlowOps - Issue Not Found Page
 */

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function IssueNotFound() {
  return (
    <div className="h-[calc(100vh-100px)] flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">改善カードが見つかりません</h1>
        <p className="text-gray-500 mb-6">
          お探しの改善カードは存在しないか、削除された可能性があります。
        </p>
        <Link
          href="/issues"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          改善カード一覧に戻る
        </Link>
      </div>
    </div>
  );
}
