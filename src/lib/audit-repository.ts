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
  hashContent,
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

  if (options.contentHash) {
    where.contentHash = options.contentHash;
  }

  if (options.policyVersion) {
    where.policyVersion = options.policyVersion;
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

/**
 * Prisma レコード → AuditLogRecord への射影。
 * ガバナンス・ハーネスのコンテンツアドレス / ポリシー版 / 重大度層を含めて返す。
 * 旧データ（新カラム未充足）は null / 既定値 'thin' へフォールバックする。
 */
function mapRecord(r: {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  traceId: string | null;
  payload: string | null;
  contentHash?: string | null;
  policyVersion?: string | null;
  policyHash?: string | null;
  severity?: string | null;
  createdAt: Date;
}): AuditLogRecord {
  return {
    id: r.id,
    actor: r.actor,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    traceId: r.traceId,
    payload: r.payload,
    contentHash: r.contentHash ?? null,
    policyVersion: r.policyVersion ?? null,
    policyHash: r.policyHash ?? null,
    severity: r.severity ?? 'thin',
    createdAt: r.createdAt,
  };
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
        // LOG-1/LOG-2: payload のコンテンツアドレス（重複排除キー）
        contentHash: hashContent(entry.payload),
        // POL-2/LOG-4: ポリシー版とその内容ハッシュ
        policyVersion: entry.policyVersion ?? null,
        policyHash: entry.policyHash ?? null,
        // §6.2: 重大度層（既定 thin）
        severity: entry.severity ?? 'thin',
      },
    });

    return mapRecord(record);
  }

  async findMany(options: AuditQueryOptions): Promise<AuditLogRecord[]> {
    const where = buildAuditWhere(options);

    const records = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return records.map(mapRecord);
  }

  async count(options: AuditQueryOptions): Promise<number> {
    const where = buildAuditWhere(options);
    return prisma.auditLog.count({ where });
  }
}

export const auditRepository = new PrismaAuditRepository();
