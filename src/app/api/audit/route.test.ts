/**
 * FlowOps - Audit Log API Route Tests
 *
 * GET /api/audit - 監査ログ照会
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

// --------------------------------------------------------
// Mocks
// --------------------------------------------------------

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      body,
      status: init?.status || 200,
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    issue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    proposal: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { findMany: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/core/audit', () => ({
  auditLog: {
    record: vi.fn(),
    logIssueAction: vi.fn(),
    logProposalAction: vi.fn(),
    logGitAction: vi.fn(),
  },
}));

// --------------------------------------------------------
// Imports
// --------------------------------------------------------

import { prisma } from '@/lib/prisma';

/** Helper to extract response body from mocked NextResponse */
function getBody(result: any): any {
  return result.body;
}

// --------------------------------------------------------
// Tests
// --------------------------------------------------------

describe('GET /api/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return paginated audit logs', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-1',
        payload: JSON.stringify({ humanId: 'ISS-001' }),
        createdAt: new Date('2025-01-01T10:00:00Z'),
      },
      {
        id: 'log-2',
        action: 'PATCH_APPLY',
        entityType: 'Proposal',
        entityId: 'proposal-1',
        payload: JSON.stringify({ commitHash: 'abc123' }),
        createdAt: new Date('2025-01-02T12:00:00Z'),
      },
    ];

    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce(mockLogs as any);
    vi.mocked(prisma.auditLog.count).mockResolvedValueOnce(2);

    const request = new Request('http://localhost:3000/api/audit', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.logs).toHaveLength(2);
    expect(body.data.logs).toEqual(mockLogs);
    expect(body.data.pagination).toEqual({
      total: 2,
      limit: 50,
      offset: 0,
      hasMore: false,
    });
    expect(result.status).toBe(200);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      skip: 0,
    });
    expect(prisma.auditLog.count).toHaveBeenCalledWith({ where: {} });
  });

  it('should filter by entityType', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-1',
        payload: '{}',
        createdAt: new Date('2025-01-01T10:00:00Z'),
      },
    ];

    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce(mockLogs as any);
    vi.mocked(prisma.auditLog.count).mockResolvedValueOnce(1);

    const request = new Request('http://localhost:3000/api/audit?entityType=Issue', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.logs).toHaveLength(1);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { entityType: 'Issue' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      skip: 0,
    });
    expect(prisma.auditLog.count).toHaveBeenCalledWith({ where: { entityType: 'Issue' } });
  });

  it('should filter by action', async () => {
    const mockLogs = [
      {
        id: 'log-3',
        action: 'PATCH_APPLY',
        entityType: 'Proposal',
        entityId: 'proposal-2',
        payload: '{}',
        createdAt: new Date('2025-01-03T14:00:00Z'),
      },
    ];

    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce(mockLogs as any);
    vi.mocked(prisma.auditLog.count).mockResolvedValueOnce(1);

    const request = new Request('http://localhost:3000/api/audit?action=PATCH_APPLY', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.logs).toHaveLength(1);
    expect(body.data.logs[0].action).toBe('PATCH_APPLY');
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { action: 'PATCH_APPLY' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      skip: 0,
    });
    expect(prisma.auditLog.count).toHaveBeenCalledWith({ where: { action: 'PATCH_APPLY' } });
  });

  it('should return empty list with correct pagination', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValueOnce(0);

    const request = new Request('http://localhost:3000/api/audit?entityType=Nonexistent', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.logs).toHaveLength(0);
    expect(body.data.pagination).toEqual({
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false,
    });
    expect(result.status).toBe(200);
  });

  it('should return 500 on error', async () => {
    vi.mocked(prisma.auditLog.findMany).mockRejectedValueOnce(
      new Error('Database connection failed')
    );

    const request = new Request('http://localhost:3000/api/audit', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(body.details).toBe('An internal error occurred');
    expect(result.status).toBe(500);
  });
});
