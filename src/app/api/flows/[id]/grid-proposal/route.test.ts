/**
 * FlowOps - Grid Proposal API Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    issue: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    proposal: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/flow-service', () => ({
  getFlow: vi.fn(),
  getFlowYaml: vi.fn(),
  getDictionary: vi.fn(),
}));

vi.mock('@/core/audit', () => ({
  auditLog: { logProposalAction: vi.fn(), record: vi.fn() },
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { getFlow, getFlowYaml, getDictionary } from '@/lib/flow-service';
import { sha256 } from '@/core/patch';
import { flowToNodeRows, flowToEdgeRows } from '@/core/grid';
import type { Flow } from '@/core/parser/schema';

const YAML = 'dummy: yaml-content\n';
const BASE_HASH = sha256(YAML);

function sampleFlow(): Flow {
  return {
    id: 'flow-1',
    title: 'テストフロー',
    layer: 'L1',
    updatedAt: '2026-01-01T00:00:00Z',
    nodes: {
      n1: { id: 'n1', type: 'start', label: '開始' },
      n2: { id: 'n2', type: 'process', label: '処理' },
      n3: { id: 'n3', type: 'end', label: '終了' },
    },
    edges: {
      e1: { id: 'e1', from: 'n1', to: 'n2' },
      e2: { id: 'e2', from: 'n2', to: 'n3' },
    },
  };
}

function makeRequest(body: unknown): any {
  return {
    json: async () => body,
    headers: { get: (k: string) => (k === 'x-actor-id' ? 'admin' : null) },
  };
}

const params = Promise.resolve({ id: 'flow-1' });

describe('POST /api/flows/[id]/grid-proposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFlow).mockResolvedValue({
      flow: sampleFlow(),
      mermaid: '',
      filePath: '/x',
    } as any);
    vi.mocked(getFlowYaml).mockResolvedValue(YAML);
    vi.mocked(getDictionary).mockResolvedValue({ roles: [], systems: [] });
  });

  it('returns 409 when baseHash is stale', async () => {
    const flow = sampleFlow();
    const result: any = await POST(
      makeRequest({
        nodeRows: flowToNodeRows(flow),
        edgeRows: flowToEdgeRows(flow),
        baseHash: 'stale-hash',
      }),
      { params }
    );
    expect(result.status).toBe(409);
    expect(result.body.errorCode).toBe('STALE_PROPOSAL');
  });

  it('returns 400 with CellError[] details for dangling edges', async () => {
    const flow = sampleFlow();
    const nodeRows = flowToNodeRows(flow);
    const edgeRows = flowToEdgeRows(flow);
    edgeRows[0].to = 'ghost'; // dangling reference

    const result: any = await POST(makeRequest({ nodeRows, edgeRows, baseHash: BASE_HASH }), {
      params,
    });

    expect(result.status).toBe(400);
    expect(result.body.errorCode).toBe('VALIDATION_ERROR');
    const parsed = JSON.parse(result.body.details);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((e: any) => e.field === 'to' && e.scope === 'edge')).toBe(true);
  });

  it('returns 400 when there are no changes', async () => {
    const flow = sampleFlow();
    const result: any = await POST(
      makeRequest({
        nodeRows: flowToNodeRows(flow),
        edgeRows: flowToEdgeRows(flow),
        baseHash: BASE_HASH,
      }),
      { params }
    );
    expect(result.status).toBe(400);
    expect(result.body.details).toContain('変更がありません');
  });

  it('creates an auto-issue and proposal on success (201)', async () => {
    const txIssue = { id: 'issue-1', humanId: 'ISS-001' };
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
      cb({
        issue: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(txIssue),
        },
      })
    );
    vi.mocked(prisma.proposal.create).mockResolvedValue({ id: 'prop-1' } as any);
    vi.mocked(prisma.issue.update).mockResolvedValue({} as any);

    const flow = sampleFlow();
    const nodeRows = flowToNodeRows(flow);
    nodeRows.find(r => r.id === 'n2')!.label = '処理(改)';

    const result: any = await POST(
      makeRequest({
        nodeRows,
        edgeRows: flowToEdgeRows(flow),
        baseHash: BASE_HASH,
        intent: 'ラベル修正',
      }),
      { params }
    );

    expect(result.status).toBe(201);
    expect(result.body.data.issueId).toBe('issue-1');
    expect(prisma.proposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issueId: 'issue-1',
          intent: 'ラベル修正',
          baseHash: BASE_HASH,
          targetFlowId: 'flow-1',
        }),
      })
    );
    expect(prisma.issue.update).toHaveBeenCalledWith({
      where: { id: 'issue-1' },
      data: { status: 'proposed' },
    });
  });

  it('uses an existing issue when issueId is provided and valid', async () => {
    vi.mocked(prisma.issue.findUnique).mockResolvedValue({
      id: 'issue-9',
      status: 'in-progress',
      targetFlowId: 'flow-1',
    } as any);
    vi.mocked(prisma.proposal.create).mockResolvedValue({ id: 'prop-2' } as any);
    vi.mocked(prisma.issue.update).mockResolvedValue({} as any);

    const flow = sampleFlow();
    const nodeRows = flowToNodeRows(flow);
    nodeRows.find(r => r.id === 'n2')!.label = '別の修正';

    const result: any = await POST(
      makeRequest({
        nodeRows,
        edgeRows: flowToEdgeRows(flow),
        baseHash: BASE_HASH,
        issueId: 'issue-9',
      }),
      { params }
    );

    expect(result.status).toBe(201);
    expect(result.body.data.issueId).toBe('issue-9');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
