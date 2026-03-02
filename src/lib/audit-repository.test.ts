/**
 * FlowOps - Audit Repository Tests
 *
 * PrismaベースのAuditLog永続化のテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./prisma', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { auditRepository } from './audit-repository';
import { prisma } from './prisma';

describe('auditRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create record with all fields and return mapped result', async () => {
      const createdAt = new Date('2026-01-01');
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 'log-1',
        actor: 'admin',
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-1',
        traceId: 'trace-abc',
        payload: '{"title":"New Issue"}',
        createdAt,
      } as any);

      const result = await auditRepository.create({
        actor: 'admin',
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-1',
        traceId: 'trace-abc',
        payload: { title: 'New Issue' },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actor: 'admin',
          action: 'ISSUE_CREATE',
          entityType: 'Issue',
          entityId: 'issue-1',
          traceId: 'trace-abc',
          payload: '{"title":"New Issue"}',
        },
      });

      expect(result).toEqual({
        id: 'log-1',
        actor: 'admin',
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-1',
        traceId: 'trace-abc',
        payload: '{"title":"New Issue"}',
        createdAt,
      });
    });

    it('should use default actor "you" when actor not provided', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 'log-2',
        actor: 'you',
        action: 'ISSUE_UPDATE',
        entityType: 'Issue',
        entityId: 'issue-2',
        traceId: null,
        payload: null,
        createdAt: new Date('2026-01-01'),
      } as any);

      await auditRepository.create({
        action: 'ISSUE_UPDATE',
        entityType: 'Issue',
        entityId: 'issue-2',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actor: 'you',
        }),
      });
    });

    it('should stringify payload as JSON', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 'log-3',
        actor: 'you',
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-3',
        traceId: null,
        payload: '{"key":"value","nested":{"n":1}}',
        createdAt: new Date('2026-01-01'),
      } as any);

      await auditRepository.create({
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-3',
        payload: { key: 'value', nested: { n: 1 } },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: '{"key":"value","nested":{"n":1}}',
        }),
      });
    });

    it('should store null payload when not provided', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 'log-4',
        actor: 'you',
        action: 'ISSUE_CLOSE',
        entityType: 'Issue',
        entityId: 'issue-4',
        traceId: null,
        payload: null,
        createdAt: new Date('2026-01-01'),
      } as any);

      await auditRepository.create({
        action: 'ISSUE_CLOSE',
        entityType: 'Issue',
        entityId: 'issue-4',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: null,
        }),
      });
    });

    it('should store traceId when provided', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 'log-5',
        actor: 'you',
        action: 'WORKFLOW_START',
        entityType: 'WorkflowExecution',
        entityId: 'wf-1',
        traceId: 'trace-xyz',
        payload: null,
        createdAt: new Date('2026-01-01'),
      } as any);

      await auditRepository.create({
        action: 'WORKFLOW_START',
        entityType: 'WorkflowExecution',
        entityId: 'wf-1',
        traceId: 'trace-xyz',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          traceId: 'trace-xyz',
        }),
      });
    });

    it('should store null traceId when not provided', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({
        id: 'log-6',
        actor: 'you',
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-6',
        traceId: null,
        payload: null,
        createdAt: new Date('2026-01-01'),
      } as any);

      await auditRepository.create({
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-6',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          traceId: null,
        }),
      });
    });
  });

  describe('findMany', () => {
    const baseMockRecord = {
      id: 'log-10',
      actor: 'you',
      action: 'ISSUE_CREATE',
      entityType: 'Issue',
      entityId: 'issue-10',
      traceId: null,
      payload: null,
      createdAt: new Date('2026-01-01'),
    };

    it('should return mapped records with default limit 50', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([baseMockRecord] as any);

      const result = await auditRepository.findMany({});

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });

      expect(result).toEqual([
        {
          id: 'log-10',
          actor: 'you',
          action: 'ISSUE_CREATE',
          entityType: 'Issue',
          entityId: 'issue-10',
          traceId: null,
          payload: null,
          createdAt: new Date('2026-01-01'),
        },
      ]);
    });

    it('should filter by entityType', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      await auditRepository.findMany({ entityType: 'Proposal' });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityType: 'Proposal' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter by entityId', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      await auditRepository.findMany({ entityId: 'issue-99' });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityId: 'issue-99' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter by action', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      await auditRepository.findMany({ action: 'PATCH_APPLY' });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { action: 'PATCH_APPLY' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter by traceId', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      await auditRepository.findMany({ traceId: 'trace-filter' });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { traceId: 'trace-filter' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter by date range (startDate + endDate)', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      await auditRepository.findMany({ startDate, endDate });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should apply custom limit and offset', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      await auditRepository.findMany({ limit: 10, offset: 20 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 20,
      });
    });
  });

  describe('count', () => {
    it('should return count with empty options', async () => {
      vi.mocked(prisma.auditLog.count).mockResolvedValue(42);

      const result = await auditRepository.count({});

      expect(prisma.auditLog.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toBe(42);
    });

    it('should filter by entityType and action', async () => {
      vi.mocked(prisma.auditLog.count).mockResolvedValue(7);

      const result = await auditRepository.count({
        entityType: 'Issue',
        action: 'ISSUE_CREATE',
      });

      expect(prisma.auditLog.count).toHaveBeenCalledWith({
        where: {
          entityType: 'Issue',
          action: 'ISSUE_CREATE',
        },
      });
      expect(result).toBe(7);
    });
  });
});
