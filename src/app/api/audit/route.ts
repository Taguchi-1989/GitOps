import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, internalErrorResponse, parsePaginationParams } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

type AuditWhere = {
  entityType?: string;
  entityId?: string;
  action?: string;
  actor?: string;
  traceId?: string;
  createdAt?: { gte?: Date; lte?: Date };
};

function buildWhere(searchParams: URLSearchParams): AuditWhere {
  const where: AuditWhere = {};
  const set = <K extends keyof AuditWhere>(key: K, val: AuditWhere[K] | null | undefined) => {
    if (val !== null && val !== undefined && val !== '') where[key] = val;
  };

  set('entityType', searchParams.get('entityType') ?? undefined);
  set('entityId', searchParams.get('entityId') ?? undefined);
  set('action', searchParams.get('action') ?? undefined);
  set('actor', searchParams.get('actor') ?? undefined);
  set('traceId', searchParams.get('traceId') ?? undefined);

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }
  return where;
}

function toCsv(
  logs: Array<{
    id: string;
    createdAt: Date;
    actor: string;
    action: string;
    entityType: string;
    entityId: string;
    traceId: string | null;
    payload: string | null;
  }>
): string {
  const header = [
    'id',
    'createdAt',
    'actor',
    'action',
    'entityType',
    'entityId',
    'traceId',
    'payload',
  ];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = logs.map(l =>
    [
      l.id,
      l.createdAt.toISOString(),
      l.actor,
      l.action,
      l.entityType,
      l.entityId,
      l.traceId,
      l.payload,
    ]
      .map(escape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const where = buildWhere(searchParams);
    const format = searchParams.get('format');

    if (format === 'csv') {
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });
      const csv = toCsv(logs);
      const filename = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
      return new Response('﻿' + csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const { limit, offset } = parsePaginationParams(searchParams);
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return successResponse({
      logs,
      pagination: { total, limit, offset, hasMore: offset + logs.length < total },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
