/**
 * FlowOps - Flow Detail API Route Tests
 *
 * GET /api/flows/[id] - フロー詳細取得
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
  getFlow: vi.fn(),
}));

vi.mock('@/lib/api-utils', async () => {
  const actual = await vi.importActual('@/lib/api-utils');
  return { ...actual };
});

// --------------------------------------------------------
// Imports
// --------------------------------------------------------

import { getFlow } from '@/lib/flow-service';

/** Helper to extract response body from mocked NextResponse */
function getBody(result: any): any {
  return result.body;
}

// --------------------------------------------------------
// Tests
// --------------------------------------------------------

describe('GET /api/flows/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return flow with mermaid data successfully', async () => {
    const mockFlowData = {
      flow: {
        id: 'order-processing',
        title: 'Order Processing',
        layer: 'L1' as const,
        updatedAt: '2026-01-01T00:00:00.000Z',
        nodes: { node1: { id: 'node1', type: 'start' as const, label: 'Start' } },
        edges: {},
      },
      mermaid: 'graph TD\n  A[Start] --> B[End]',
      filePath: 'spec/flows/order-processing.yaml',
    };

    vi.mocked(getFlow).mockResolvedValueOnce(mockFlowData as any);

    const request = new Request('http://localhost:3000/api/flows/order-processing', {
      method: 'GET',
    });

    const result = await GET(request as any, { params: { id: 'order-processing' } });
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(body.data.flow).toEqual(mockFlowData.flow);
    expect(body.data.mermaid).toBe(mockFlowData.mermaid);
    expect(body.data.filePath).toBe(mockFlowData.filePath);
    expect(result.status).toBe(200);
    expect(getFlow).toHaveBeenCalledWith('order-processing');
  });

  it('should return 404 if flow not found', async () => {
    vi.mocked(getFlow).mockResolvedValueOnce(null);

    const request = new Request('http://localhost:3000/api/flows/nonexistent', {
      method: 'GET',
    });

    const result = await GET(request as any, { params: { id: 'nonexistent' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('NOT_FOUND');
    expect(body.details).toBe('Flow not found');
    expect(result.status).toBe(404);
  });

  it('should return 400 if flowId has invalid characters (path traversal attempt)', async () => {
    const request = new Request('http://localhost:3000/api/flows/../etc/passwd', {
      method: 'GET',
    });

    const result = await GET(request as any, { params: { id: '../etc/passwd' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.details).toBe('Invalid flow ID');
    expect(result.status).toBe(400);
    expect(getFlow).not.toHaveBeenCalled();
  });

  it('should return 500 on error', async () => {
    vi.mocked(getFlow).mockRejectedValueOnce(new Error('Disk read failure'));

    const request = new Request('http://localhost:3000/api/flows/order-processing', {
      method: 'GET',
    });

    const result = await GET(request as any, { params: { id: 'order-processing' } });
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
    expect(body.details).toBe('Disk read failure');
    expect(result.status).toBe(500);
  });
});
