/**
 * FlowOps - Issue Detail API Route Tests
 *
 * GET /api/issues/[id] - Issue詳細取得
 * PATCH /api/issues/[id] - Issue更新
 * DELETE /api/issues/[id] - Issue削除
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from './route';

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

// issue types のモックは実際のスキーマを使用
vi.mock('@/core/issue', async () => {
  const actual = await vi.importActual('@/core/issue/types');
  return actual;
});

import { prisma } from '@/lib/prisma';
import { auditLog } from '@/core/audit';

/** モックレスポンスからbodyを取得するヘルパー */
function getBody(result: any): any {
  return result.body;
}

// --------------------------------------------------------
// Tests
// --------------------------------------------------------

describe('GET /api/issues/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return issue with proposals, evidences, and duplicates', async () => {
    const mockIssue = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'new',
      targetFlowId: 'flow-123',
      targetNodeId: 'node-456',
      deletedAt: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
      proposals: [
        {
          id: 'proposal-1',
          issueId: 'issue-1',
          intent: 'Fix the bug',
          jsonPatch: [],
          baseHash: 'abc123',
          isApplied: false,
          createdAt: new Date('2025-01-03'),
        },
      ],
      evidences: [
        {
          id: 'evidence-1',
          issueId: 'issue-1',
          type: 'screenshot',
          url: 'https://example.com/screenshot.png',
          note: 'Error screenshot',
          createdAt: new Date('2025-01-02'),
        },
      ],
      duplicates: [
        {
          id: 'issue-2',
          humanId: 'ISS-002',
          title: 'Duplicate Issue',
          status: 'merged-duplicate',
        },
      ],
      canonicalIssue: null,
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockIssue as any);

    const request = new Request('http://localhost:3000/api/issues/issue-1', {
      method: 'GET',
    });

    const result = await GET(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.id).toBe('issue-1');
    expect(body.data.humanId).toBe('ISS-001');
    expect(body.data.proposals).toHaveLength(1);
    expect(body.data.evidences).toHaveLength(1);
    expect(body.data.duplicates).toHaveLength(1);
    expect(result.status).toBe(200);
    expect(prisma.issue.findUnique).toHaveBeenCalledWith({
      where: { id: 'issue-1', deletedAt: null },
      include: {
        proposals: {
          orderBy: { createdAt: 'desc' },
        },
        evidences: {
          orderBy: { createdAt: 'desc' },
        },
        duplicates: {
          select: { id: true, humanId: true, title: true, status: true },
        },
        canonicalIssue: {
          select: { id: true, humanId: true, title: true, status: true },
        },
      },
    });
  });

  it('should return issue with canonicalIssue when it is a duplicate', async () => {
    const mockIssue = {
      id: 'issue-2',
      humanId: 'ISS-002',
      title: 'Duplicate Issue',
      description: 'This is a duplicate',
      status: 'merged-duplicate',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      proposals: [],
      evidences: [],
      duplicates: [],
      canonicalIssue: {
        id: 'issue-1',
        humanId: 'ISS-001',
        title: 'Original Issue',
        status: 'merged',
      },
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockIssue as any);

    const request = new Request('http://localhost:3000/api/issues/issue-2', {
      method: 'GET',
    });

    const result = await GET(request as any, { params: { id: 'issue-2' } });
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.canonicalIssue).toBeDefined();
    expect(body.data.canonicalIssue.id).toBe('issue-1');
    expect(body.data.canonicalIssue.humanId).toBe('ISS-001');
  });

  it('should return 404 when issue is not found', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/nonexistent', {
      method: 'GET',
    });

    const result = await GET(request as any, { params: { id: 'nonexistent' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(body.details).toBe('Issue not found');
    expect(result.status).toBe(404);
  });

  it('should return 404 when issue is soft-deleted', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/deleted-1', {
      method: 'GET',
    });

    const result = await GET(request as any, { params: { id: 'deleted-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(result.status).toBe(404);
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(prisma.issue.findUnique).mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost:3000/api/issues/issue-1', {
      method: 'GET',
    });

    const result = await GET(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(result.status).toBe(500);
  });
});

describe('PATCH /api/issues/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update issue title successfully', async () => {
    const mockExisting = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Old Title',
      description: 'Old description',
      status: 'new',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUpdated = {
      ...mockExisting,
      title: 'New Title',
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockExisting as any);
    vi.mocked(prisma.issue.update).mockResolvedValue(mockUpdated as any);
    vi.mocked(auditLog.record).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/issue-1', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'New Title',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await PATCH(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.title).toBe('New Title');
    expect(result.status).toBe(200);
    expect(prisma.issue.update).toHaveBeenCalledWith({
      where: { id: 'issue-1' },
      data: {
        title: 'New Title',
        description: undefined,
        status: undefined,
      },
    });
    expect(auditLog.record).toHaveBeenCalledWith({
      action: 'ISSUE_UPDATE',
      entityType: 'Issue',
      entityId: 'issue-1',
      payload: {
        before: {
          title: 'Old Title',
          description: 'Old description',
          status: 'new',
        },
        after: { title: 'New Title' },
      },
    });
  });

  it('should update issue description successfully', async () => {
    const mockExisting = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Title',
      description: 'Old description',
      status: 'new',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUpdated = {
      ...mockExisting,
      description: 'New description',
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockExisting as any);
    vi.mocked(prisma.issue.update).mockResolvedValue(mockUpdated as any);
    vi.mocked(auditLog.record).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/issue-1', {
      method: 'PATCH',
      body: JSON.stringify({
        description: 'New description',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await PATCH(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.description).toBe('New description');
  });

  it('should update issue status successfully', async () => {
    const mockExisting = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Title',
      description: 'Test description',
      status: 'new',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUpdated = {
      ...mockExisting,
      status: 'in-progress',
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockExisting as any);
    vi.mocked(prisma.issue.update).mockResolvedValue(mockUpdated as any);
    vi.mocked(auditLog.record).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/issue-1', {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'in-progress',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await PATCH(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('in-progress');
  });

  it('should update multiple fields at once', async () => {
    const mockExisting = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Old Title',
      description: 'Old description',
      status: 'new',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUpdated = {
      ...mockExisting,
      title: 'New Title',
      description: 'New description',
      status: 'triage',
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockExisting as any);
    vi.mocked(prisma.issue.update).mockResolvedValue(mockUpdated as any);
    vi.mocked(auditLog.record).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/issue-1', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'New Title',
        description: 'New description',
        status: 'triage',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await PATCH(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.title).toBe('New Title');
    expect(body.data.description).toBe('New description');
    expect(body.data.status).toBe('triage');
  });

  it('should return 404 when issue does not exist', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/nonexistent', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'New Title',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await PATCH(request as any, {
      params: { id: 'nonexistent' },
    });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(body.details).toBe('Issue not found');
    expect(result.status).toBe(404);
    expect(prisma.issue.update).not.toHaveBeenCalled();
  });

  it('should return validation error for invalid status', async () => {
    const mockExisting = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Title',
      description: 'Test description',
      status: 'new',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockExisting as any);

    const request = new Request('http://localhost:3000/api/issues/issue-1', {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'invalid-status',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await PATCH(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(result.status).toBe(400);
    expect(prisma.issue.update).not.toHaveBeenCalled();
  });

  it('should return validation error for empty title', async () => {
    const mockExisting = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Title',
      description: 'Test description',
      status: 'new',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockExisting as any);

    const request = new Request('http://localhost:3000/api/issues/issue-1', {
      method: 'PATCH',
      body: JSON.stringify({
        title: '',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await PATCH(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(result.status).toBe(400);
  });

  it('should handle database errors during update', async () => {
    const mockExisting = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Title',
      description: 'Test description',
      status: 'new',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockExisting as any);
    vi.mocked(prisma.issue.update).mockRejectedValue(new Error('Database write failed'));

    const request = new Request('http://localhost:3000/api/issues/issue-1', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'New Title',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await PATCH(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(result.status).toBe(500);
  });
});

describe('DELETE /api/issues/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should soft delete issue successfully', async () => {
    const mockExisting = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'new',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockExisting as any);
    vi.mocked(prisma.issue.update).mockResolvedValue({
      ...mockExisting,
      deletedAt: new Date(),
    } as any);
    vi.mocked(auditLog.record).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/issue-1', {
      method: 'DELETE',
    });

    const result = await DELETE(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.deleted).toBe(true);
    expect(result.status).toBe(200);
    expect(prisma.issue.update).toHaveBeenCalledWith({
      where: { id: 'issue-1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(auditLog.record).toHaveBeenCalledWith({
      action: 'ISSUE_DELETE',
      entityType: 'Issue',
      entityId: 'issue-1',
      payload: { humanId: 'ISS-001' },
    });
  });

  it('should return 404 when issue does not exist', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/nonexistent', {
      method: 'DELETE',
    });

    const result = await DELETE(request as any, {
      params: { id: 'nonexistent' },
    });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(body.details).toBe('Issue not found');
    expect(result.status).toBe(404);
    expect(prisma.issue.update).not.toHaveBeenCalled();
  });

  it('should handle already deleted issues gracefully', async () => {
    const mockDeleted = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'new',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: new Date('2025-01-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockDeleted as any);
    vi.mocked(prisma.issue.update).mockResolvedValue(mockDeleted as any);
    vi.mocked(auditLog.record).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/issue-1', {
      method: 'DELETE',
    });

    const result = await DELETE(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.deleted).toBe(true);
  });

  it('should handle database errors during deletion', async () => {
    const mockExisting = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'new',
      targetFlowId: null,
      targetNodeId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockExisting as any);
    vi.mocked(prisma.issue.update).mockRejectedValue(new Error('Database write failed'));

    const request = new Request('http://localhost:3000/api/issues/issue-1', {
      method: 'DELETE',
    });

    const result = await DELETE(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(result.status).toBe(500);
  });
});
