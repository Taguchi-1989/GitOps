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

    if (options.traceId) {
      where.traceId = options.traceId;
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        (where.createdAt as Record<string, Date>).gte = options.startDate;
      }
      if (options.endDate) {
        (where.createdAt as Record<string, Date>).lte = options.endDate;
      }
    }

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

    return prisma.auditLog.count({ where });
  }
}

export const auditRepository = new PrismaAuditRepository();
