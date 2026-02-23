/**
 * FlowOps - Flows API Route Tests
 *
 * GET /api/flows - フロー一覧取得
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

vi.mock('@/lib/flow-service', () => ({
  listFlows: vi.fn(),
}));

// --------------------------------------------------------
// Imports
// --------------------------------------------------------

import { listFlows } from '@/lib/flow-service';

/** Helper to extract response body from mocked NextResponse */
function getBody(result: any): any {
  return result.body;
}

// --------------------------------------------------------
// Tests
// --------------------------------------------------------

describe('GET /api/flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return flows list successfully', async () => {
    const mockFlows = [
      {
        id: 'flow-1',
        title: 'Order Processing',
        layer: 'L1',
        nodeCount: 5,
        edgeCount: 4,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'flow-2',
        title: 'Shipping Flow',
        layer: 'L2',
        nodeCount: 3,
        edgeCount: 2,
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ];

    vi.mocked(listFlows).mockResolvedValueOnce(mockFlows as any);

    const request = new Request('http://localhost:3000/api/flows', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.flows).toEqual(mockFlows);
    expect(body.data.flows).toHaveLength(2);
    expect(result.status).toBe(200);
    expect(listFlows).toHaveBeenCalledOnce();
  });

  it('should return empty array when no flows exist', async () => {
    vi.mocked(listFlows).mockResolvedValueOnce([]);

    const request = new Request('http://localhost:3000/api/flows', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.flows).toEqual([]);
    expect(body.data.flows).toHaveLength(0);
    expect(result.status).toBe(200);
  });

  it('should return 500 on error', async () => {
    vi.mocked(listFlows).mockRejectedValueOnce(new Error('File system error'));

    const request = new Request('http://localhost:3000/api/flows', {
      method: 'GET',
    });

    const result = await GET(request as any);
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(body.details).toBe('File system error');
    expect(result.status).toBe(500);
  });
});
