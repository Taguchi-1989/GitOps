/**
 * FlowOps - Manual Proposal Import API Route Tests
 *
 * POST /api/issues/[id]/proposals/import - コピペで改善案を取り込む
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
    issue: { findUnique: vi.fn(), update: vi.fn() },
    proposal: { create: vi.fn() },
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
import { auditLog } from '@/core/audit';

function getBody(result: any): any {
  return result.body;
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/issues/issue-1/proposals/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const inProgressIssue = () =>
  createMockIssue({
    title: 'Fix order flow',
    description: 'The approval step is missing',
    status: 'in-progress',
    targetFlowId: 'order-processing',
    branchName: 'issue/ISS-001-fix',
  });

const VALID_OUTPUT = {
  intent: '承認ステップを追加',
  patches: [{ op: 'replace', path: '/title', value: 'Updated' }],
};

// --------------------------------------------------------
// Tests
// --------------------------------------------------------

describe('POST /api/issues/[id]/proposals/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 if issue not found', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(null);

    const result = await POST(makeRequest({ text: 'x' }) as any, {
      params: Promise.resolve({ id: 'nonexistent' }),
    });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(result.status).toBe(404);
  });

  it('should return 400 if status is not in-progress', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(
      createMockIssue({ status: 'new', targetFlowId: 'flow-1' })
    );

    const result = await POST(makeRequest({ text: 'x' }) as any, {
      params: Promise.resolve({ id: 'issue-1' }),
    });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INVALID_STATUS_TRANSITION');
    expect(result.status).toBe(400);
  });

  it('should return 400 if text is empty', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(inProgressIssue());

    const result = await POST(makeRequest({ text: '   ' }) as any, {
      params: Promise.resolve({ id: 'issue-1' }),
    });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(result.status).toBe(400);
  });

  it('should return 400 if no JSON found in pasted text', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(inProgressIssue());

    const result = await POST(
      makeRequest({ text: 'こんにちは、これはJSONではありません' }) as any,
      {
        params: Promise.resolve({ id: 'issue-1' }),
      }
    );
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.details).toContain('JSON');
    expect(result.status).toBe(400);
  });

  it('should return 400 if JSON does not match schema', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(inProgressIssue());

    const result = await POST(makeRequest({ text: '{"foo": "bar"}' }) as any, {
      params: Promise.resolve({ id: 'issue-1' }),
    });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.details).toContain('形式');
    expect(result.status).toBe(400);
  });

  it('should return 400 if patches violate constraints (unknown role)', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(inProgressIssue());

    const output = {
      intent: 'role変更',
      patches: [{ op: 'replace', path: '/nodes/n1/role', value: 'unknown-role' }],
    };
    const result = await POST(makeRequest({ text: JSON.stringify(output) }) as any, {
      params: Promise.resolve({ id: 'issue-1' }),
    });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.details).toContain('ルール違反');
    expect(result.status).toBe(400);
  });

  it('should create proposal from pasted AI output with code fences and preamble', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValueOnce(inProgressIssue());
    vi.mocked(getFlowYaml).mockResolvedValueOnce('title: Order Processing\nnodes: {}');

    const mockProposal = {
      id: 'proposal-1',
      issueId: 'issue-1',
      intent: VALID_OUTPUT.intent,
      jsonPatch: JSON.stringify(VALID_OUTPUT.patches),
      diffPreview: null,
      baseHash: 'hash123',
      targetFlowId: 'order-processing',
      isApplied: false,
      appliedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.proposal.create).mockResolvedValueOnce(mockProposal as any);
    vi.mocked(prisma.issue.update).mockResolvedValueOnce({} as any);

    // AIの回答にありがちな前置き＋コードフェンス付き
    const pasted = `はい、改善案を作成しました。\n\n\`\`\`json\n${JSON.stringify(VALID_OUTPUT)}\n\`\`\`\n\nご確認ください。`;

    const result = await POST(makeRequest({ text: pasted }) as any, {
      params: Promise.resolve({ id: 'issue-1' }),
    });
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(result.status).toBe(201);

    expect(prisma.issue.update).toHaveBeenCalledWith({
      where: { id: 'issue-1' },
      data: { status: 'proposed' },
    });

    expect(auditLog.logProposalAction).toHaveBeenCalledWith(
      'PROPOSAL_GENERATE',
      'proposal-1',
      expect.objectContaining({ source: 'manual-paste' }),
      undefined
    );
  });
});
