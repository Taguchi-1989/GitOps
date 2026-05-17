import { AuditLogClient } from './AuditLogClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '監査ログ - FlowOps' };

export default function AuditPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          監査ログ
        </h1>
        <p className="mt-1 text-gray-700 dark:text-gray-300">
          誰が・いつ・何を行ったかの履歴を絞り込んで確認・CSVエクスポートできます
        </p>
      </header>
      <AuditLogClient />
    </div>
  );
}
