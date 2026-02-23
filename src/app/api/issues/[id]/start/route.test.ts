/**
 * FlowOps - Issue Start API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

// Helper to extract response body
function getBody(result: any): any {
  return result.body;
}

// ============================================================================
// Mocks
// ============================================================================

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

vi.mock('@/core/audit', () => ({
  auditLog: {
    record: vi.fn(),
    logIssueAction: vi.fn(),
    logProposalAction: vi.fn(),
    logGitAction: vi.fn(),
  },
}));

vi.mock('@/core/git', () => ({
  getGitManager: vi.fn(() => ({
    createBranch: vi.fn(),
    mergeAndClose: vi.fn(),
    commitChanges: vi.fn(() => ({ hash: 'abc123', message: 'test commit' })),
    hasCommits: vi.fn(() => true),
    cherryPick: vi.fn(() => ['commit1']),
    deleteBranch: vi.fn(),
  })),
}));

vi.mock('@/core/issue/humanId', () => ({
  generateBranchName: vi.fn(() => 'issue/ISS-001-test'),
  titleToSlug: vi.fn(() => 'test'),
}));

// ============================================================================
// Import mocked modules
// ============================================================================

import { prisma } from '@/lib/prisma';
import { auditLog } from '@/core/audit';
import { getGitManager } from '@/core/git';
import { generateBranchName, titleToSlug } from '@/core/issue/humanId';

// ============================================================================
// Tests
// ============================================================================

describe('POST /api/issues/[id]/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 if issue not found', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/issue-1/start', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'issue-1' } });

    expect(result.status).toBe(404);
    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(body.details).toBe('Issue not found');
  });

  it('returns 400 if status is not new or triage (in-progress case)', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue({
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'in-progress',
      branchName: null,
      targetFlowId: null,
      targetNodeId: null,
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new Request('http://localhost:3000/api/issues/issue-1/start', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'issue-1' } });

    expect(result.status).toBe(400);
    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INVALID_STATUS_TRANSITION');
    expect(body.details).toContain('Cannot start work on issue with status: in-progress');
  });

  it('returns 400 if branchName already exists', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue({
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'new',
      branchName: 'issue/ISS-001-existing',
      targetFlowId: null,
      targetNodeId: null,
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new Request('http://localhost:3000/api/issues/issue-1/start', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'issue-1' } });

    expect(result.status).toBe(400);
    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INVALID_STATUS_TRANSITION');
    expect(body.details).toContain('Issue already has a branch');
  });

  it('successfully starts issue from new status', async () => {
    const issue = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'new',
      branchName: null,
      targetFlowId: null,
      targetNodeId: null,
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedIssue = {
      ...issue,
      status: 'in-progress',
      branchName: 'issue/ISS-001-test',
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(issue);
    vi.mocked(prisma.issue.update).mockResolvedValue(updatedIssue as any);
    vi.mocked(titleToSlug).mockReturnValue('test');
    vi.mocked(generateBranchName).mockReturnValue('issue/ISS-001-test');

    const mockGit = {
      createBranch: vi.fn().mockResolvedValue(null),
      mergeAndClose: vi.fn(),
      commitChanges: vi.fn(() => ({ hash: 'abc123', message: 'test commit' })),
      hasCommits: vi.fn(() => true),
      cherryPick: vi.fn(() => ['commit1']),
      deleteBranch: vi.fn(),
    };
    vi.mocked(getGitManager).mockReturnValue(mockGit as any);

    const request = new Request('http://localhost:3000/api/issues/issue-1/start', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'issue-1' } });

    expect(result.status).toBe(200);
    const body = getBody(result);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('in-progress');
    expect(body.data.branchName).toBe('issue/ISS-001-test');

    // Verify git branch was created
    expect(mockGit.createBranch).toHaveBeenCalledWith('issue/ISS-001-test');

    // Verify DB was updated
    expect(prisma.issue.update).toHaveBeenCalledWith({
      where: { id: 'issue-1' },
      data: {
        status: 'in-progress',
        branchName: 'issue/ISS-001-test',
      },
    });

    // Verify audit logs
    expect(auditLog.logGitAction).toHaveBeenCalledWith('GIT_BRANCH_CREATE', 'issue-1', {
      branchName: 'issue/ISS-001-test',
    });
    expect(auditLog.logIssueAction).toHaveBeenCalledWith('ISSUE_START', 'issue-1', {
      branchName: 'issue/ISS-001-test',
    });
  });

  it('successfully starts issue from triage status', async () => {
    const issue = {
      id: 'issue-2',
      humanId: 'ISS-002',
      title: 'Triaged Issue',
      description: 'Test description',
      status: 'triage',
      branchName: null,
      targetFlowId: null,
      targetNodeId: null,
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedIssue = {
      ...issue,
      status: 'in-progress',
      branchName: 'issue/ISS-001-test',
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(issue);
    vi.mocked(prisma.issue.update).mockResolvedValue(updatedIssue as any);
    vi.mocked(titleToSlug).mockReturnValue('test');
    vi.mocked(generateBranchName).mockReturnValue('issue/ISS-001-test');

    const mockGit = {
      createBranch: vi.fn().mockResolvedValue(null),
      mergeAndClose: vi.fn(),
      commitChanges: vi.fn(() => ({ hash: 'abc123', message: 'test commit' })),
      hasCommits: vi.fn(() => true),
      cherryPick: vi.fn(() => ['commit1']),
      deleteBranch: vi.fn(),
    };
    vi.mocked(getGitManager).mockReturnValue(mockGit as any);

    const request = new Request('http://localhost:3000/api/issues/issue-2/start', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'issue-2' } });

    expect(result.status).toBe(200);
    const body = getBody(result);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('in-progress');
    expect(body.data.branchName).toBe('issue/ISS-001-test');

    // Verify git branch was created
    expect(mockGit.createBranch).toHaveBeenCalledWith('issue/ISS-001-test');
  });

  it('returns 500 on database error', async () => {
    vi.mocked(prisma.issue.findUnique).mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost:3000/api/issues/issue-1/start', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'issue-1' } });

    expect(result.status).toBe(500);
    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(body.details).toBe('Database connection failed');
  });

  it('returns 500 on git error', async () => {
    const issue = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'new',
      branchName: null,
      targetFlowId: null,
      targetNodeId: null,
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(issue);
    vi.mocked(titleToSlug).mockReturnValue('test');
    vi.mocked(generateBranchName).mockReturnValue('issue/ISS-001-test');

    const mockGit = {
      createBranch: vi.fn().mockRejectedValue(new Error('Git operation failed')),
      mergeAndClose: vi.fn(),
      commitChanges: vi.fn(() => ({ hash: 'abc123', message: 'test commit' })),
      hasCommits: vi.fn(() => true),
      cherryPick: vi.fn(() => ['commit1']),
      deleteBranch: vi.fn(),
    };
    vi.mocked(getGitManager).mockReturnValue(mockGit as any);

    const request = new Request('http://localhost:3000/api/issues/issue-1/start', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'issue-1' } });

    expect(result.status).toBe(500);
    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(body.details).toBe('Git operation failed');
  });
});
