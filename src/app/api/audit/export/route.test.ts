/**
 * FlowOps - Audit Export API Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, status: init?.status || 200, __json: true })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: { findMany: vi.fn() },
    workflowExecution: { findMany: vi.fn() },
  },
}));

vi.mock('@/core/audit', () => ({
  auditLog: { record: vi.fn() },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/core/audit';

function auditRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    actor: 'admin',
    action: 'PROPOSAL_GENERATE',
    entityType: 'Proposal',
    entityId: 'prop-1',
    traceId: null,
    payload: JSON.stringify({ intent: '改善' }),
    createdAt: new Date('2026-01-15T03:00:00Z'),
    ...overrides,
  };
}

describe('GET /api/audit/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([auditRecord()] as any);
    vi.mocked(prisma.workflowExecution.findMany).mockResolvedValue([] as any);
  });

  it('exports CSV with BOM and attachment headers, and self-audits DATA_EXPORT', async () => {
    const request = new Request('http://localhost:3000/api/audit/export?format=csv', {
      method: 'GET',
      headers: { 'x-actor-id': 'admin' },
    });

    const result: any = await GET(request as any);

    expect(result.status).toBe(200);
    expect(result.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(result.headers.get('Content-Disposition')).toContain('attachment');
    // The encoded bytes must start with the UTF-8 BOM (EF BB BF) so Excel reads UTF-8.
    // (Response.text() strips a leading BOM per spec, so check the raw bytes.)
    const bytes = new Uint8Array(await result.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8').decode(bytes);
    expect(text).toContain('アクション');

    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DATA_EXPORT',
        entityType: 'System',
        entityId: 'audit-log',
        actor: 'admin',
      })
    );
  });

  it('exports HTML report inline', async () => {
    const request = new Request('http://localhost:3000/api/audit/export?format=html', {
      method: 'GET',
    });

    const result: any = await GET(request as any);

    expect(result.status).toBe(200);
    expect(result.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(result.headers.get('Content-Disposition')).toBe('inline');
    const text = await result.text();
    expect(text).toContain('FlowOps 監査レポート');
  });

  it('rejects an invalid format with 400', async () => {
    const request = new Request('http://localhost:3000/api/audit/export?format=pdf', {
      method: 'GET',
    });

    const result: any = await GET(request as any);

    expect(result.status).toBe(400);
    expect(result.body.errorCode).toBe('VALIDATION_ERROR');
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('rejects an invalid action filter with 400', async () => {
    const request = new Request('http://localhost:3000/api/audit/export?format=csv&action=BOGUS', {
      method: 'GET',
    });

    const result: any = await GET(request as any);

    expect(result.status).toBe(400);
    expect(result.body.errorCode).toBe('VALIDATION_ERROR');
  });
});
