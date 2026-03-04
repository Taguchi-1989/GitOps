/**
 * FlowOps - Health Check API Route Tests
 *
 * GET /api/health - ヘルスチェック
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

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return healthy status when database is connected', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ 1: 1 }]);

    const request = new Request('http://localhost:3000/api/health', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('healthy');
    expect(body.data.timestamp).toBeDefined();
    expect(body.data.services.database).toBe('connected');
    expect(result.status).toBe(200);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('should return 500 when database is unavailable', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('Connection refused'));

    const request = new Request('http://localhost:3000/api/health', {
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
