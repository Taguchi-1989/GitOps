/**
 * FlowOps - Audit Repository (Prisma Implementation)
 *
 * PrismaベースのAuditLog永続化
 */

import { prisma } from './prisma';
import {
  IAuditLogRepository,
  AuditLogRecord,
  AuditLogEntry,
  AuditQueryOptions,
} from '@/core/audit';

/**
 * AuditQueryOptions から Prisma の where 句を構築する。
 * findMany / count / route handler で共用し、フィルタ漏れを防ぐ。
 */
export function buildAuditWhere(options: AuditQueryOptions): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (options.entityType) {
    where.entityType = options.entityType;
  }

  if (options.entityId) {
    where.entityId = options.entityId;
  }

  if (options.action) {
    where.action = options.action;
  }

  if (options.actor) {
    where.actor = options.actor;
  }

  if (options.traceId) {
    where.traceId = options.traceId;
  }

  if (options.startDate || options.endDate) {
    const createdAt: Record<string, Date> = {};
    if (options.startDate) {
      createdAt.gte = options.startDate;
    }
    if (options.endDate) {
      createdAt.lte = options.endDate;
    }
    where.createdAt = createdAt;
  }

  return where;
}

class PrismaAuditRepository implements IAuditLogRepository {
  async create(entry: AuditLogEntry): Promise<AuditLogRecord> {
    const record = await prisma.auditLog.create({
      data: {
        actor: entry.actor || 'you',
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        traceId: entry.traceId || null,
        payload: entry.payload ? JSON.stringify(entry.payload) : null,
      },
    });

    return {
      id: record.id,
      actor: record.actor,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      traceId: record.traceId,
      payload: record.payload,
      createdAt: record.createdAt,
    };
  }

  async findMany(options: AuditQueryOptions): Promise<AuditLogRecord[]> {
    const where = buildAuditWhere(options);

    const records = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return records.map(r => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      traceId: r.traceId,
      payload: r.payload,
      createdAt: r.createdAt,
    }));
  }

  async count(options: AuditQueryOptions): Promise<number> {
    const where = buildAuditWhere(options);
    return prisma.auditLog.count({ where });
  }
}

export const auditRepository = new PrismaAuditRepository();
