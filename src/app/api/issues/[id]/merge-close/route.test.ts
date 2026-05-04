/**
 * FlowOps - Merge & Close API Tests
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

// ============================================================================
// Tests
// ============================================================================

describe('POST /api/issues/[id]/merge-close', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 if issue not found', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/issue-1/merge-close', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });

    expect(result.status).toBe(404);
    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(body.details).toBe('Issue not found');
  });

  it('returns 400 if status is not proposed', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue({
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'in-progress',
      branchName: 'issue/ISS-001-test',
      targetFlowId: null,
      targetNodeId: null,
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new Request('http://localhost:3000/api/issues/issue-1/merge-close', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });

    expect(result.status).toBe(400);
    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INVALID_STATUS_TRANSITION');
    expect(body.details).toContain('Cannot merge issue with status: in-progress');
    expect(body.details).toContain('Must be proposed');
  });

  it('returns 400 if no branch name', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue({
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'proposed',
      branchName: null,
      targetFlowId: null,
      targetNodeId: null,
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new Request('http://localhost:3000/api/issues/issue-1/merge-close', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });

    expect(result.status).toBe(400);
    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.details).toBe('Issue has no branch to merge');
  });

  it('returns 400 if no applied proposal found', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue({
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'proposed',
      branchName: 'issue/ISS-001-test',
      targetFlowId: null,
      targetNodeId: null,
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(prisma.proposal.findFirst).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/issue-1/merge-close', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });

    expect(result.status).toBe(400);
    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.details).toBe('No proposal has been applied yet');

    // Verify the query was correct
    expect(prisma.proposal.findFirst).toHaveBeenCalledWith({
      where: {
        issueId: 'issue-1',
        isApplied: true,
      },
    });
  });

  it('successfully merges and closes issue', async () => {
    const issue = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'proposed',
      branchName: 'issue/ISS-001-test',
      targetFlowId: null,
      targetNodeId: null,
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const appliedProposal = {
      id: 'proposal-1',
      issueId: 'issue-1',
      intent: 'Test proposal',
      jsonPatch: '[]',
      diffPreview: null,
      baseHash: 'hash123',
      targetFlowId: 'flow1',
      isApplied: true,
      appliedAt: new Date(),
      createdAt: new Date(),
    };

    const mergedIssue = {
      ...issue,
      status: 'merged',
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(issue);
    vi.mocked(prisma.proposal.findFirst).mockResolvedValue(appliedProposal);
    vi.mocked(prisma.issue.update).mockResolvedValue(mergedIssue as any);

    const mockGit = {
      createBranch: vi.fn(),
      mergeAndClose: vi.fn().mockResolvedValue(undefined),
      commitChanges: vi.fn(() => ({ hash: 'abc123', message: 'test commit' })),
      hasCommits: vi.fn(() => true),
      cherryPick: vi.fn(() => ['commit1']),
      deleteBranch: vi.fn(),
    };
    vi.mocked(getGitManager).mockReturnValue(mockGit as any);

    const request = new Request('http://localhost:3000/api/issues/issue-1/merge-close', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });

    expect(result.status).toBe(200);
    const body = getBody(result);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('merged');

    // Verify git merge was called
    expect(mockGit.mergeAndClose).toHaveBeenCalledWith('issue/ISS-001-test');

    // Verify DB was updated
    expect(prisma.issue.update).toHaveBeenCalledWith({
      where: { id: 'issue-1' },
      data: {
        status: 'merged',
      },
    });

    // Verify audit logs
    expect(auditLog.logGitAction).toHaveBeenCalledWith('MERGE_CLOSE', 'issue-1', {
      branchName: 'issue/ISS-001-test',
    });
    expect(auditLog.logIssueAction).toHaveBeenCalledWith('ISSUE_CLOSE', 'issue-1', {
      status: 'merged',
    });
  });

  it('returns 500 on database error', async () => {
    vi.mocked(prisma.issue.findUnique).mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost:3000/api/issues/issue-1/merge-close', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });

    expect(result.status).toBe(500);
    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(body.details).toBe('An internal error occurred');
  });

  it('returns 500 on git error during merge', async () => {
    const issue = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'proposed',
      branchName: 'issue/ISS-001-test',
      targetFlowId: null,
      targetNodeId: null,
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const appliedProposal = {
      id: 'proposal-1',
      issueId: 'issue-1',
      intent: 'Test proposal',
      jsonPatch: '[]',
      diffPreview: null,
      baseHash: 'hash123',
      targetFlowId: 'flow1',
      isApplied: true,
      appliedAt: new Date(),
      createdAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(issue);
    vi.mocked(prisma.proposal.findFirst).mockResolvedValue(appliedProposal);

    const mockGit = {
      createBranch: vi.fn(),
      mergeAndClose: vi.fn().mockRejectedValue(new Error('Merge conflict detected')),
      commitChanges: vi.fn(() => ({ hash: 'abc123', message: 'test commit' })),
      hasCommits: vi.fn(() => true),
      cherryPick: vi.fn(() => ['commit1']),
      deleteBranch: vi.fn(),
    };
    vi.mocked(getGitManager).mockReturnValue(mockGit as any);

    const request = new Request('http://localhost:3000/api/issues/issue-1/merge-close', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });

    expect(result.status).toBe(500);
    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(body.details).toBe('An internal error occurred');
  });

  it('verifies proposal query includes both issueId and isApplied conditions', async () => {
    const issue = {
      id: 'issue-xyz',
      humanId: 'ISS-100',
      title: 'Complex Issue',
      description: 'Test description',
      status: 'proposed',
      branchName: 'issue/ISS-100-complex',
      targetFlowId: null,
      targetNodeId: null,
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValue(issue);
    vi.mocked(prisma.proposal.findFirst).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/issues/issue-xyz/merge-close', {
      method: 'POST',
    });

    await POST(request as any, { params: Promise.resolve({ id: 'issue-xyz' }) });

    // Verify the proposal query uses the correct issueId
    expect(prisma.proposal.findFirst).toHaveBeenCalledWith({
      where: {
        issueId: 'issue-xyz',
        isApplied: true,
      },
    });
  });
});
