/**
 * FlowOps - Audit Log Page
 *
 * 監査ログの照会とレポート出力
 */

import { prisma } from '@/lib/prisma';
import { AuditLogClient } from './AuditLogClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '監査ログ - FlowOps',
  description: '操作履歴の照会と監査レポート出力',
};

const PAGE_SIZE = 50;

async function getInitialLogs() {
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: 0,
    }),
    prisma.auditLog.count(),
  ]);

  return {
    logs: logs.map(l => ({
      id: l.id,
      actor: l.actor,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      traceId: l.traceId,
      payload: l.payload,
      createdAt: l.createdAt.toISOString(),
    })),
    pagination: {
      total,
      limit: PAGE_SIZE,
      offset: 0,
      hasMore: logs.length < total,
    },
  };
}

export default async function AuditPage() {
  const initial = await getInitialLogs();

  return (
    <div className="p-6">
      <AuditLogClient initialLogs={initial.logs} initialPagination={initial.pagination} />
    </div>
  );
}
