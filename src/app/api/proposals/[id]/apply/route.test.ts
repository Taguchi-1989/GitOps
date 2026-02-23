/**
 * FlowOps - Apply Proposal API Route Tests
 *
 * POST /api/proposals/[id]/apply - 提案を適用
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

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

vi.mock('@/lib/flow-service', () => ({
  getFlowYaml: vi.fn(() => 'title: Test'),
  saveFlowYaml: vi.fn(),
  getFlow: vi.fn(() => ({
    flow: { id: 'test', title: 'Test', nodes: {}, edges: {} },
    mermaid: '',
    filePath: '',
  })),
}));

vi.mock('@/core/patch', () => ({
  applyPatchesToFlow: vi.fn(() => ({ flow: { id: 'test', title: 'Updated' }, results: [] })),
  sha256: vi.fn(() => 'abc123'),
  PatchApplyError: class PatchApplyError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  JsonPatch: {},
}));

vi.mock('@/core/parser', () => ({
  stringifyFlow: vi.fn(() => 'title: Updated'),
}));

vi.mock('@/core/git', () => ({
  getGitManager: vi.fn(() => ({
    commitChanges: vi.fn(() => ({ hash: 'commit123', message: 'feat: apply proposal' })),
  })),
}));

// --------------------------------------------------------
// Imports
// --------------------------------------------------------

import { prisma } from '@/lib/prisma';
import { getFlowYaml, saveFlowYaml, getFlow } from '@/lib/flow-service';
import { applyPatchesToFlow, sha256, PatchApplyError } from '@/core/patch';
import { stringifyFlow } from '@/core/parser';
import { getGitManager } from '@/core/git';
import { auditLog } from '@/core/audit';

/** Helper to extract response body from mocked NextResponse */
function getBody(result: any): any {
  return result.body;
}

// --------------------------------------------------------
// Tests
// --------------------------------------------------------

describe('POST /api/proposals/[id]/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 if proposal not found', async () => {
    vi.mocked(prisma.proposal.findUnique).mockResolvedValueOnce(null);

    const request = new Request('http://localhost:3000/api/proposals/nonexistent/apply', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'nonexistent' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(body.details).toBe('Proposal not found');
    expect(result.status).toBe(404);
  });

  it('should return 400 if already applied', async () => {
    vi.mocked(prisma.proposal.findUnique).mockResolvedValueOnce({
      id: 'proposal-1',
      issueId: 'issue-1',
      intent: 'Fix order flow',
      jsonPatch: JSON.stringify([{ op: 'replace', path: '/title', value: 'Updated' }]),
      diffPreview: null,
      baseHash: 'abc123',
      targetFlowId: 'order-processing',
      isApplied: true,
      appliedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      issue: {
        id: 'issue-1',
        humanId: 'ISS-001',
        title: 'Test Issue',
        description: 'Test',
        status: 'proposed',
      },
    } as any);

    const request = new Request('http://localhost:3000/api/proposals/proposal-1/apply', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'proposal-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INVALID_STATUS_TRANSITION');
    expect(body.details).toContain('already been applied');
    expect(result.status).toBe(400);
  });

  it('should return 400 if no targetFlowId', async () => {
    vi.mocked(prisma.proposal.findUnique).mockResolvedValueOnce({
      id: 'proposal-1',
      issueId: 'issue-1',
      intent: 'Fix order flow',
      jsonPatch: JSON.stringify([{ op: 'replace', path: '/title', value: 'Updated' }]),
      diffPreview: null,
      baseHash: 'abc123',
      targetFlowId: null,
      isApplied: false,
      appliedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      issue: {
        id: 'issue-1',
        humanId: 'ISS-001',
        title: 'Test Issue',
        description: 'Test',
        status: 'proposed',
      },
    } as any);

    const request = new Request('http://localhost:3000/api/proposals/proposal-1/apply', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'proposal-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.details).toContain('no target flow');
    expect(result.status).toBe(400);
  });

  it('should return 409 if baseHash mismatch (stale)', async () => {
    vi.mocked(prisma.proposal.findUnique).mockResolvedValueOnce({
      id: 'proposal-1',
      issueId: 'issue-1',
      intent: 'Fix order flow',
      jsonPatch: JSON.stringify([{ op: 'replace', path: '/title', value: 'Updated' }]),
      diffPreview: null,
      baseHash: 'old-hash-from-proposal',
      targetFlowId: 'order-processing',
      isApplied: false,
      appliedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      issue: {
        id: 'issue-1',
        humanId: 'ISS-001',
        title: 'Test Issue',
        description: 'Test',
        status: 'proposed',
      },
    } as any);

    // sha256 returns a different hash than the proposal's baseHash
    vi.mocked(sha256).mockReturnValueOnce('different-current-hash');

    const request = new Request('http://localhost:3000/api/proposals/proposal-1/apply', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'proposal-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('STALE_PROPOSAL');
    expect(body.details).toContain('modified since proposal was generated');
    expect(result.status).toBe(409);
  });

  it('should successfully apply proposal and commit', async () => {
    const mockProposal = {
      id: 'proposal-1',
      issueId: 'issue-1',
      intent: 'Fix order flow',
      jsonPatch: JSON.stringify([{ op: 'replace', path: '/title', value: 'Updated' }]),
      diffPreview: null,
      baseHash: 'abc123',
      targetFlowId: 'order-processing',
      isApplied: false,
      appliedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      issue: {
        id: 'issue-1',
        humanId: 'ISS-001',
        title: 'Test Issue',
        description: 'Test',
        status: 'proposed',
      },
    };

    const updatedProposal = {
      ...mockProposal,
      isApplied: true,
      appliedAt: new Date(),
    };

    vi.mocked(prisma.proposal.findUnique).mockResolvedValueOnce(mockProposal as any);
    vi.mocked(prisma.proposal.update).mockResolvedValueOnce(updatedProposal as any);

    const mockCommitResult = { hash: 'commit123', message: 'feat: apply proposal for ISS-001' };
    const mockGit = {
      commitChanges: vi.fn().mockResolvedValueOnce(mockCommitResult),
    };
    vi.mocked(getGitManager).mockReturnValueOnce(mockGit as any);

    const request = new Request('http://localhost:3000/api/proposals/proposal-1/apply', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'proposal-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.proposal).toEqual(updatedProposal);
    expect(body.data.commit).toEqual(mockCommitResult);
    expect(result.status).toBe(200);

    // Verify flow was fetched
    expect(getFlow).toHaveBeenCalledWith('order-processing');
    expect(getFlowYaml).toHaveBeenCalledWith('order-processing');

    // Verify patches were applied
    expect(applyPatchesToFlow).toHaveBeenCalled();

    // Verify YAML was stringified and saved
    expect(stringifyFlow).toHaveBeenCalled();
    expect(saveFlowYaml).toHaveBeenCalledWith('order-processing', 'title: Updated');

    // Verify git commit
    expect(mockGit.commitChanges).toHaveBeenCalledWith('feat: apply proposal for ISS-001', [
      'spec/flows/order-processing.yaml',
    ]);

    // Verify DB update
    expect(prisma.proposal.update).toHaveBeenCalledWith({
      where: { id: 'proposal-1' },
      data: {
        isApplied: true,
        appliedAt: expect.any(Date),
      },
    });

    // Verify audit logs
    expect(auditLog.logProposalAction).toHaveBeenCalledWith('PATCH_APPLY', 'proposal-1', {
      issueId: 'issue-1',
      commitHash: 'commit123',
      patchCount: 1,
    });
    expect(auditLog.logGitAction).toHaveBeenCalledWith('GIT_COMMIT', 'issue-1', {
      commitHash: 'commit123',
      message: 'feat: apply proposal for ISS-001',
    });
  });

  it('should return 400 on PatchApplyError', async () => {
    const mockProposal = {
      id: 'proposal-1',
      issueId: 'issue-1',
      intent: 'Fix order flow',
      jsonPatch: JSON.stringify([{ op: 'replace', path: '/nonexistent/path', value: 'Bad' }]),
      diffPreview: null,
      baseHash: 'abc123',
      targetFlowId: 'order-processing',
      isApplied: false,
      appliedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      issue: {
        id: 'issue-1',
        humanId: 'ISS-001',
        title: 'Test Issue',
        description: 'Test',
        status: 'proposed',
      },
    };

    vi.mocked(prisma.proposal.findUnique).mockResolvedValueOnce(mockProposal as any);

    // Make applyPatchesToFlow throw a PatchApplyError
    vi.mocked(applyPatchesToFlow).mockImplementationOnce(() => {
      throw new PatchApplyError('PATCH_APPLY_FAILED', 'Path /nonexistent/path does not exist');
    });

    const request = new Request('http://localhost:3000/api/proposals/proposal-1/apply', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'proposal-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('PATCH_APPLY_FAILED');
    expect(body.details).toContain('Patch apply failed');
    expect(body.details).toContain('Path /nonexistent/path does not exist');
    expect(result.status).toBe(400);

    // Verify no git commit or DB update happened
    expect(saveFlowYaml).not.toHaveBeenCalled();
    expect(prisma.proposal.update).not.toHaveBeenCalled();
  });
});
