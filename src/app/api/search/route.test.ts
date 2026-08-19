/**
 * FlowOps - Search API Route Tests
 *
 * GET /api/search - 改善カード・フロー・ヘルプの横断検索
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
    issue: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/flow-service', () => ({
  listFlows: vi.fn(),
}));

// --------------------------------------------------------
// Imports
// --------------------------------------------------------

import { prisma } from '@/lib/prisma';
import { listFlows } from '@/lib/flow-service';

/** URL だけを持つ最小のリクエスト */
function makeRequest(url: string): any {
  return { url };
}

const FLOWS = [
  { id: 'order-intake', title: '受注受付フロー', layer: 'L1', nodeCount: 4, edgeCount: 3 },
  { id: 'billing', title: '請求フロー', layer: 'L2', nodeCount: 2, edgeCount: 1 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.issue.findMany).mockResolvedValue([] as never);
  vi.mocked(listFlows).mockResolvedValue(FLOWS as never);
});

// --------------------------------------------------------
// Tests
// --------------------------------------------------------

describe('GET /api/search', () => {
  it('q が無いときは空の結果を返し、DBを引かない', async () => {
    const result: any = await GET(makeRequest('http://localhost/api/search'));

    expect(result.body).toEqual({
      ok: true,
      data: { issues: [], flows: [], help: [] },
    });
    expect(prisma.issue.findMany).not.toHaveBeenCalled();
  });

  it('改善カードをステータスで絞らずに検索する', async () => {
    vi.mocked(prisma.issue.findMany).mockResolvedValue([
      { id: 'i1', humanId: 'ISS-0001', title: '受注が二度手間', status: 'closed' },
    ] as never);

    const result: any = await GET(makeRequest('http://localhost/api/search?q=受注'));

    expect(result.body.data.issues).toHaveLength(1);
    const where = vi.mocked(prisma.issue.findMany).mock.calls[0][0]?.where as any;
    expect(where.deletedAt).toBeNull();
    expect(where.status).toBeUndefined();
  });

  it('タイトル・IDでフローを絞り込む', async () => {
    const result: any = await GET(makeRequest('http://localhost/api/search?q=billing'));

    expect(result.body.data.flows).toEqual([{ id: 'billing', title: '請求フロー', layer: 'L2' }]);
  });

  it('ヘルプ記事もヒットする', async () => {
    const result: any = await GET(makeRequest('http://localhost/api/search?q=ブランチ'));

    expect(result.body.data.help.length).toBeGreaterThan(0);
    expect(result.body.data.help[0]).toHaveProperty('slug');
    expect(result.body.data.help[0]).toHaveProperty('excerpt');
  });

  it('該当なしのときは全グループが空', async () => {
    const result: any = await GET(makeRequest('http://localhost/api/search?q=zzzznotfoundzzzz'));

    expect(result.body.data).toEqual({ issues: [], flows: [], help: [] });
  });

  it('例外時は500を返す', async () => {
    vi.mocked(listFlows).mockRejectedValue(new Error('boom'));

    const result: any = await GET(makeRequest('http://localhost/api/search?q=受注'));

    expect(result.status).toBe(500);
    expect(result.body.ok).toBe(false);
  });
});
