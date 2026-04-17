/**
 * FlowOps - Generate Proposal API Route Tests
 *
 * POST /api/issues/[id]/proposals/generate - LLMで提案を生成
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

vi.mock('@/lib/prisma', () => {
  const mockPrisma: any = {
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
  };
  mockPrisma.$transaction = vi.fn(async (fn: any) => fn(mockPrisma));
  return { prisma: mockPrisma };
});

vi.mock('@/core/audit', () => ({
  auditLog: {
    record: vi.fn(),
    logIssueAction: vi.fn(),
    logProposalAction: vi.fn(),
    logGitAction: vi.fn(),
  },
}));

vi.mock('@/lib/flow-service', () => ({
  getFlowYaml: vi.fn(),
  getDictionary: vi.fn(() => ({ roles: ['operator'], systems: ['ERP'] })),
}));

vi.mock('@/core/llm', () => ({
  getLLMClient: vi.fn(() => ({
    generateProposal: vi.fn(() => ({
      intent: 'Test proposal',
      patches: [{ op: 'replace', path: '/title', value: 'Updated' }],
    })),
  })),
  LLMError: class LLMError extends Error {
    code: string;
    constructor(code: string, msg: string) {
      super(msg);
      this.code = code;
    }
  },
}));

vi.mock('@/core/patch', () => ({
  sha256: vi.fn(() => 'hash123'),
  applyPatches: vi.fn(flow => flow),
  diffFlows: vi.fn(() => ({ entries: [] })),
  formatDiffAsHtml: vi.fn(() => '<div></div>'),
}));

vi.mock('@/core/parser', () => ({
  parseFlowYaml: vi.fn(() => ({ success: true, flow: { id: 'test', title: 'Test' } })),
}));

// --------------------------------------------------------
// Imports
// --------------------------------------------------------

import { prisma } from '@/lib/prisma';
import { getFlowYaml } from '@/lib/flow-service';
import { getLLMClient, LLMError } from '@/core/llm';
import { auditLog } from '@/core/audit';

/** Helper to extract response body from mocked NextResponse */
function getBody(result: any): any {
  return result.body;
}

// --------------------------------------------------------
// Tests
// --------------------------------------------------------

describe('POST /api/issues/[id]/proposals/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 if issue not found', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(null);

    const request = new Request('http://localhost:3000/api/issues/nonexistent/proposals/generate', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'nonexistent' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(body.details).toBe('Issue not found');
    expect(result.status).toBe(404);
  });

  it('should return 400 if status is not in-progress', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce({
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'new',
      targetFlowId: 'flow-1',
      targetNodeId: null,
      branchName: null,
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new Request('http://localhost:3000/api/issues/issue-1/proposals/generate', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INVALID_STATUS_TRANSITION');
    expect(body.details).toContain('Cannot generate proposal for issue with status: new');
    expect(result.status).toBe(400);
  });

  it('should return 400 if no targetFlowId', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce({
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'in-progress',
      targetFlowId: null,
      targetNodeId: null,
      branchName: 'issue/ISS-001-test',
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new Request('http://localhost:3000/api/issues/issue-1/proposals/generate', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.details).toContain('targetFlowId');
    expect(result.status).toBe(400);
  });

  it('should return 404 if flow YAML not found', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce({
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Test Issue',
      description: 'Test description',
      status: 'in-progress',
      targetFlowId: 'missing-flow',
      targetNodeId: null,
      branchName: 'issue/ISS-001-test',
      canonicalId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(getFlowYaml).mockResolvedValueOnce(null);

    const request = new Request('http://localhost:3000/api/issues/issue-1/proposals/generate', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(body.details).toContain('Target flow not found');
    expect(result.status).toBe(404);
  });

  it('should create proposal successfully', async () => {
    const mockIssue = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Fix order flow',
      description: 'The approval step is missing',
      status: 'in-progress',
      targetFlowId: 'order-processing',
      targetNodeId: null,
      branchName: 'issue/ISS-001-fix',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockProposal = {
      id: 'proposal-1',
      issueId: 'issue-1',
      intent: 'Test proposal',
      jsonPatch: JSON.stringify([{ op: 'replace', path: '/title', value: 'Updated' }]),
      diffPreview: null,
      baseHash: 'hash123',
      targetFlowId: 'order-processing',
      isApplied: false,
      appliedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(mockIssue as any);
    vi.mocked(getFlowYaml).mockResolvedValueOnce('title: Order Processing\nnodes: {}');
    vi.mocked(prisma.proposal.create).mockResolvedValueOnce(mockProposal as any);
    vi.mocked(prisma.issue.update).mockResolvedValueOnce({
      ...mockIssue,
      status: 'proposed',
    } as any);

    const request = new Request('http://localhost:3000/api/issues/issue-1/proposals/generate', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data).toEqual(mockProposal);
    expect(result.status).toBe(201);

    // Verify proposal was created with correct data
    expect(prisma.proposal.create).toHaveBeenCalledWith({
      data: {
        issueId: 'issue-1',
        intent: 'Test proposal',
        jsonPatch: JSON.stringify([{ op: 'replace', path: '/title', value: 'Updated' }]),
        diffPreview: null,
        baseHash: 'hash123',
        targetFlowId: 'order-processing',
      },
    });

    // Verify issue status was updated to 'proposed'
    expect(prisma.issue.update).toHaveBeenCalledWith({
      where: { id: 'issue-1' },
      data: { status: 'proposed' },
    });

    // Verify audit log was recorded
    expect(auditLog.logProposalAction).toHaveBeenCalledWith('PROPOSAL_GENERATE', 'proposal-1', {
      issueId: 'issue-1',
      baseHash: 'hash123',
      intent: 'Test proposal',
      patchCount: 1,
    });
  });

  it('should return 500 on LLM error', async () => {
    const mockIssue = {
      id: 'issue-1',
      humanId: 'ISS-001',
      title: 'Fix order flow',
      description: 'The approval step is missing',
      status: 'in-progress',
      targetFlowId: 'order-processing',
      targetNodeId: null,
      branchName: 'issue/ISS-001-fix',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(mockIssue as any);
    vi.mocked(getFlowYaml).mockResolvedValueOnce('title: Order Processing\nnodes: {}');

    // Make LLM throw an LLMError
    const mockLLMError = new LLMError('API_ERROR', 'Rate limit exceeded');
    vi.mocked(getLLMClient).mockReturnValueOnce({
      generateProposal: vi.fn().mockRejectedValueOnce(mockLLMError),
    } as any);

    const request = new Request('http://localhost:3000/api/issues/issue-1/proposals/generate', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: { id: 'issue-1' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('LLM_ERROR');
    expect(body.details).toContain('LLM error');
    expect(body.details).toContain('Rate limit exceeded');
    expect(result.status).toBe(500);
  });
});
