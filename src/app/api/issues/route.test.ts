/**
 * FlowOps - Issues API Route Tests
 *
 * GET /api/issues - Issue一覧取得
 * POST /api/issues - Issue作成
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';

// --------------------------------------------------------
// Mocks
// --------------------------------------------------------

// next/server のモック
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      body,
      status: init?.status || 200,
    })),
  },
}));

// logger のモック
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// prisma のモック
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
    proposal: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

// auditLog のモック
vi.mock('@/core/audit', () => ({
  auditLog: {
    record: vi.fn(),
    logIssueAction: vi.fn(),
    logProposalAction: vi.fn(),
    logGitAction: vi.fn(),
  },
}));

// humanId のモック
vi.mock('@/core/issue/humanId', () => ({
  generateHumanId: vi.fn((seq: number) => `ISS-${String(seq).padStart(3, '0')}`),
  parseHumanId: vi.fn(),
  generateBranchName: vi.fn(),
  titleToSlug: vi.fn(),
}));

// issue types のモックは実際のスキーマを使用
import { CreateIssueSchema } from '@/core/issue/types';
vi.mock('@/core/issue', async () => {
  const actual = await vi.importActual('@/core/issue/types');
  return actual;
});

import { prisma } from '@/lib/prisma';
import { auditLog } from '@/core/audit';
import { generateHumanId } from '@/core/issue/humanId';

/** モックレスポンスからbodyを取得するヘルパー */
function getBody(result: any): any {
  return result.body;
}

// --------------------------------------------------------
// Tests
// --------------------------------------------------------

describe('GET /api/issues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return paginated issues list with default limit and offset', async () => {
    const mockIssues = [
      {
        id: 'issue-1',
        humanId: 'ISS-001',
        title: 'Test Issue 1',
        description: 'Description 1',
        status: 'new',
        targetFlowId: null,
        targetNodeId: null,
        deletedAt: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
        _count: { proposals: 2, evidences: 1 },
      },
      {
        id: 'issue-2',
        humanId: 'ISS-002',
        title: 'Test Issue 2',
        description: 'Description 2',
        status: 'triage',
        targetFlowId: null,
        targetNodeId: null,
        deletedAt: null,
        createdAt: new Date('2025-01-03'),
        updatedAt: new Date('2025-01-04'),
        _count: { proposals: 0, evidences: 0 },
      },
    ];

    vi.mocked(prisma.issue.findMany).mockResolvedValue(mockIssues as any);
    vi.mocked(prisma.issue.count).mockResolvedValue(2);

    const request = new Request('http://localhost:3000/api/issues', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.issues).toHaveLength(2);
    expect(body.data.pagination).toEqual({
      total: 2,
      limit: 50,
      offset: 0,
      hasMore: false,
    });
    expect(prisma.issue.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      skip: 0,
      include: {
        _count: {
          select: { proposals: true, evidences: true },
        },
      },
    });
  });

  it('should filter issues by status query parameter', async () => {
    const mockIssues = [
      {
        id: 'issue-1',
        humanId: 'ISS-001',
        title: 'Test Issue',
        description: 'Description',
        status: 'new',
        targetFlowId: null,
        targetNodeId: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { proposals: 0, evidences: 0 },
      },
    ];

    vi.mocked(prisma.issue.findMany).mockResolvedValue(mockIssues as any);
    vi.mocked(prisma.issue.count).mockResolvedValue(1);

    const request = new Request('http://localhost:3000/api/issues?status=new', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.issues).toHaveLength(1);
    expect(prisma.issue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, status: 'new' },
      })
    );
  });

  it('should filter issues by targetFlowId query parameter', async () => {
    const mockIssues = [
      {
        id: 'issue-1',
        humanId: 'ISS-001',
        title: 'Test Issue',
        description: 'Description',
        status: 'new',
        targetFlowId: 'flow-123',
        targetNodeId: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { proposals: 0, evidences: 0 },
      },
    ];

    vi.mocked(prisma.issue.findMany).mockResolvedValue(mockIssues as any);
    vi.mocked(prisma.issue.count).mockResolvedValue(1);

    const request = new Request('http://localhost:3000/api/issues?targetFlowId=flow-123', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(prisma.issue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, targetFlowId: 'flow-123' },
      })
    );
  });

  it('should apply custom limit and offset for pagination', async () => {
    const mockIssues = [
      {
        id: 'issue-3',
        humanId: 'ISS-003',
        title: 'Test Issue 3',
        description: 'Description',
        status: 'new',
        targetFlowId: null,
        targetNodeId: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { proposals: 0, evidences: 0 },
      },
    ];

    vi.mocked(prisma.issue.findMany).mockResolvedValue(mockIssues as any);
    vi.mocked(prisma.issue.count).mockResolvedValue(100);

    const request = new Request('http://localhost:3000/api/issues?limit=10&offset=20', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.pagination).toEqual({
      total: 100,
      limit: 10,
      offset: 20,
      hasMore: true,
    });
    expect(prisma.issue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 20,
      })
    );
  });

  it('should return empty issues list when no issues match', async () => {
    vi.mocked(prisma.issue.findMany).mockResolvedValue([]);
    vi.mocked(prisma.issue.count).mockResolvedValue(0);

    const request = new Request('http://localhost:3000/api/issues', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.issues).toHaveLength(0);
    expect(body.data.pagination.total).toBe(0);
    expect(body.data.pagination.hasMore).toBe(false);
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(prisma.issue.findMany).mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost:3000/api/issues', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(result.status).toBe(500);
  });
});

describe('POST /api/issues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new issue with humanId generation', async () => {
    const mockLastIssue = { humanId: 'ISS-042' };
    const mockCreatedIssue = {
      id: 'issue-123',
      humanId: 'ISS-043',
      title: 'New Issue',
      description: 'Issue description',
      status: 'new',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findFirst).mockResolvedValue(mockLastIssue as any);
    vi.mocked(prisma.issue.create).mockResolvedValue(mockCreatedIssue as any);
    vi.mocked(generateHumanId).mockReturnValue('ISS-043');
    vi.mocked(auditLog.record).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: 'New Issue',
        description: 'Issue description',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await POST(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.humanId).toBe('ISS-043');
    expect(body.data.title).toBe('New Issue');
    expect(result.status).toBe(201);
    expect(generateHumanId).toHaveBeenCalledWith(43);
    expect(prisma.issue.create).toHaveBeenCalledWith({
      data: {
        humanId: 'ISS-043',
        title: 'New Issue',
        description: 'Issue description',
        targetFlowId: undefined,
        targetNodeId: undefined,
        status: 'new',
      },
    });
    expect(auditLog.record).toHaveBeenCalledWith({
      action: 'ISSUE_CREATE',
      entityType: 'Issue',
      entityId: 'issue-123',
      payload: {
        humanId: 'ISS-043',
        title: 'New Issue',
        targetFlowId: undefined,
      },
    });
  });

  it('should create first issue with ISS-001 when no previous issues exist', async () => {
    const mockCreatedIssue = {
      id: 'issue-first',
      humanId: 'ISS-001',
      title: 'First Issue',
      description: 'First issue description',
      status: 'new',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.issue.create).mockResolvedValue(mockCreatedIssue as any);
    vi.mocked(generateHumanId).mockReturnValue('ISS-001');
    vi.mocked(auditLog.record).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: 'First Issue',
        description: 'First issue description',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await POST(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.humanId).toBe('ISS-001');
    expect(generateHumanId).toHaveBeenCalledWith(1);
  });

  it('should create issue with optional targetFlowId and targetNodeId', async () => {
    const mockCreatedIssue = {
      id: 'issue-123',
      humanId: 'ISS-001',
      title: 'Issue with target',
      description: 'Description',
      status: 'new',
      targetFlowId: 'flow-456',
      targetNodeId: 'node-789',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.issue.create).mockResolvedValue(mockCreatedIssue as any);
    vi.mocked(generateHumanId).mockReturnValue('ISS-001');
    vi.mocked(auditLog.record).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Issue with target',
        description: 'Description',
        targetFlowId: 'flow-456',
        targetNodeId: 'node-789',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await POST(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(prisma.issue.create).toHaveBeenCalledWith({
      data: {
        humanId: 'ISS-001',
        title: 'Issue with target',
        description: 'Description',
        targetFlowId: 'flow-456',
        targetNodeId: 'node-789',
        status: 'new',
      },
    });
  });

  it('should return validation error for missing title', async () => {
    const request = new Request('http://localhost:3000/api/issues', {
      method: 'POST',
      body: JSON.stringify({
        description: 'Description without title',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await POST(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.details).toContain('title');
    expect(result.status).toBe(400);
    expect(prisma.issue.create).not.toHaveBeenCalled();
  });

  it('should return validation error for missing description', async () => {
    const request = new Request('http://localhost:3000/api/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Title without description',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await POST(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.details).toContain('description');
    expect(result.status).toBe(400);
  });

  it('should return validation error for empty title', async () => {
    const request = new Request('http://localhost:3000/api/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: '',
        description: 'Valid description',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await POST(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(result.status).toBe(400);
  });

  it('should return validation error for title exceeding 200 characters', async () => {
    const longTitle = 'a'.repeat(201);

    const request = new Request('http://localhost:3000/api/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: longTitle,
        description: 'Valid description',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await POST(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(result.status).toBe(400);
  });

  it('should handle database errors during issue creation', async () => {
    vi.mocked(prisma.issue.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.issue.create).mockRejectedValue(new Error('Database write failed'));
    vi.mocked(generateHumanId).mockReturnValue('ISS-001');

    const request = new Request('http://localhost:3000/api/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Issue',
        description: 'Test description',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await POST(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(result.status).toBe(500);
  });
});
