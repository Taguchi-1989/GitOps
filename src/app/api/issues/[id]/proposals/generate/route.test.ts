/**
 * FlowOps - Generate Proposal API Route Tests
 *
 * POST /api/issues/[id]/proposals/generate - LLMで提案を生成
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { createMockIssue } from '@/test/helpers';

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

// 入口ゲート（§4.1）はここではパススルーをデフォルトとし、ゲート本体の挙動は
// src/core/ingress/guard.test.ts で検証する。ブロック経路はテスト内で個別に上書きする。
vi.mock('@/core/ingress', () => ({
  guardIngress: vi.fn(async (fields: Record<string, string>) => ({
    fields,
    evaluation: { decision: 'pass' },
    perField: {},
  })),
  IngressBlockedError: class IngressBlockedError extends Error {
    constructor() {
      super('Ingress gate blocked external send: email(value)');
      this.name = 'IngressBlockedError';
    }
  },
}));

// --------------------------------------------------------
// Imports
// --------------------------------------------------------

import { prisma } from '@/lib/prisma';
import { getFlowYaml } from '@/lib/flow-service';
import { getLLMClient, LLMError } from '@/core/llm';
import { auditLog } from '@/core/audit';
import { guardIngress, IngressBlockedError } from '@/core/ingress';

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

    const result = await POST(request as any, { params: Promise.resolve({ id: 'nonexistent' }) });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(body.details).toBe('Issue not found');
    expect(result.status).toBe(404);
  });

  it('should return 400 if status is not in-progress', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(
      createMockIssue({
        title: 'Test Issue',
        description: 'Test description',
        status: 'new',
        targetFlowId: 'flow-1',
      })
    );

    const request = new Request('http://localhost:3000/api/issues/issue-1/proposals/generate', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INVALID_STATUS_TRANSITION');
    expect(body.details).toContain('Cannot generate proposal for issue with status: new');
    expect(result.status).toBe(400);
  });

  it('should return 400 if no targetFlowId', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(
      createMockIssue({
        title: 'Test Issue',
        description: 'Test description',
        status: 'in-progress',
        targetFlowId: null,
        branchName: 'issue/ISS-001-test',
      })
    );

    const request = new Request('http://localhost:3000/api/issues/issue-1/proposals/generate', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.details).toContain('targetFlowId');
    expect(result.status).toBe(400);
  });

  it('should return 404 if flow YAML not found', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(
      createMockIssue({
        title: 'Test Issue',
        description: 'Test description',
        status: 'in-progress',
        targetFlowId: 'missing-flow',
        branchName: 'issue/ISS-001-test',
      })
    );

    vi.mocked(getFlowYaml).mockResolvedValueOnce(null);

    const request = new Request('http://localhost:3000/api/issues/issue-1/proposals/generate', {
      method: 'POST',
    });

    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });
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

    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });
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

    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('LLM_ERROR');
    expect(body.details).toContain('LLM error');
    expect(body.details).toContain('Rate limit exceeded');
    expect(result.status).toBe(500);
  });

  it('入口ゲートが機密を検出したら 422 INGRESS_BLOCKED を返し、LLMを呼ばない', async () => {
    const mockIssue = createMockIssue({
      title: 'Fix order flow',
      description: 'secret AKIAIOSFODNN7EXAMPLE',
      status: 'in-progress',
      targetFlowId: 'order-processing',
    });
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(mockIssue as any);
    vi.mocked(getFlowYaml).mockResolvedValueOnce('title: Order Processing\nnodes: {}');

    // 入口ゲートをブロック挙動に上書き
    vi.mocked(guardIngress).mockRejectedValueOnce(new IngressBlockedError('1.0.0', 'full', []));
    const generateProposal = vi.fn();
    vi.mocked(getLLMClient).mockReturnValueOnce({ generateProposal } as any);

    const request = new Request('http://localhost:3000/api/issues/issue-1/proposals/generate', {
      method: 'POST',
    });
    const result = await POST(request as any, { params: Promise.resolve({ id: 'issue-1' }) });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INGRESS_BLOCKED');
    expect(result.status).toBe(422);
    // 外部送出（LLM）は行われない
    expect(generateProposal).not.toHaveBeenCalled();
  });
});
