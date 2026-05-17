import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

function getBody(result: any): any {
  return result.body;
}

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, status: init?.status || 200 })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    issue: { findUnique: vi.fn(), update: vi.fn() },
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

import { prisma } from '@/lib/prisma';
import { auditLog } from '@/core/audit';

describe('POST /api/issues/[id]/return-to-progress', () => {
  beforeEach(() => vi.clearAllMocks());

  const makeRequest = (body?: object) =>
    new Request('http://localhost:3000/api/issues/issue-1/return-to-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

  const mockProposed = {
    id: 'issue-1',
    humanId: 'ISS-001',
    status: 'proposed',
    title: 'Test',
    description: 'Test',
  };

  it('should return-to-progress when proposed with reason', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue(mockProposed as any);
    vi.mocked(prisma.issue.update).mockResolvedValue({
      ...mockProposed,
      status: 'in-progress',
    } as any);

    const result = await POST(makeRequest({ reason: '関係部門と再調整必要' }) as any, {
      params: Promise.resolve({ id: 'issue-1' }),
    });

    expect(getBody(result).ok).toBe(true);
    expect(prisma.issue.update).toHaveBeenCalledWith({
      where: { id: 'issue-1' },
      data: { status: 'in-progress' },
    });
    expect(auditLog.logIssueAction).toHaveBeenCalledWith(
      'ISSUE_UPDATE',
      'issue-1',
      expect.objectContaining({
        from: 'proposed',
        to: 'in-progress',
        action: 'return-to-progress',
        reason: '関係部門と再調整必要',
      })
    );
  });

  it('should reject when reason is missing', async () => {
    const result = await POST(makeRequest({}) as any, {
      params: Promise.resolve({ id: 'issue-1' }),
    });

    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(result.status).toBe(400);
    expect(prisma.issue.update).not.toHaveBeenCalled();
  });

  it('should reject when reason is empty string', async () => {
    const result = await POST(makeRequest({ reason: '   ' }) as any, {
      params: Promise.resolve({ id: 'issue-1' }),
    });
    expect(getBody(result).ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it('should return 404 when issue does not exist', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue(null);

    const result = await POST(makeRequest({ reason: 'x' }) as any, {
      params: Promise.resolve({ id: 'missing' }),
    });
    expect(getBody(result).ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it('should reject when issue is not in proposed status', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue({
      ...mockProposed,
      status: 'new',
    } as any);

    const result = await POST(makeRequest({ reason: 'x' }) as any, {
      params: Promise.resolve({ id: 'issue-1' }),
    });
    const body = getBody(result);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INVALID_STATUS_TRANSITION');
    expect(result.status).toBe(400);
  });

  it('should handle invalid JSON body', async () => {
    const req = new Request('http://localhost:3000/api/issues/issue-1/return-to-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    const result = await POST(req as any, { params: Promise.resolve({ id: 'issue-1' }) });
    expect(getBody(result).ok).toBe(false);
    expect(result.status).toBe(400);
  });
});
