/**
 * FlowOps - Audit Report Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: { findMany: vi.fn() },
    workflowExecution: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  collectAuditRows,
  renderAuditCsv,
  renderAuditHtml,
  type EnrichedAuditRow,
} from './audit-report';

function auditRecord(overrides: Partial<EnrichedAuditRow> = {}): any {
  return {
    id: 'log-1',
    actor: 'admin',
    action: 'PROPOSAL_GENERATE',
    entityType: 'Proposal',
    entityId: 'prop-1',
    traceId: null,
    payload: null,
    createdAt: new Date('2026-01-15T03:00:00Z'),
    ...overrides,
  };
}

describe('collectAuditRows', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enriches rows with trace info (models deduped, tokens summed)', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([
      auditRecord({ traceId: 'trace-1', payload: JSON.stringify({ intent: 'やる' }) }),
    ] as any);
    vi.mocked(prisma.workflowExecution.findMany).mockResolvedValueOnce([
      {
        traceId: 'trace-1',
        flowId: 'flow-x',
        status: 'completed',
        taskExecutions: [
          { gitCommitHash: 'abc', llmModelUsed: 'gpt-4', llmTokensInput: 10, llmTokensOutput: 5 },
          { gitCommitHash: 'abc', llmModelUsed: 'gpt-4', llmTokensInput: 3, llmTokensOutput: 2 },
          { gitCommitHash: 'def', llmModelUsed: 'claude', llmTokensInput: 1, llmTokensOutput: 1 },
        ],
        approvalRequests: [
          { decision: 'approved', decidedBy: 'boss', reason: 'OK', decidedAt: new Date() },
        ],
      },
    ] as any);

    const { rows, truncated } = await collectAuditRows({});

    expect(truncated).toBe(false);
    expect(rows).toHaveLength(1);
    const t = rows[0].trace!;
    expect(t.llmModelsUsed.sort()).toEqual(['claude', 'gpt-4']);
    expect(t.totalTokensInput).toBe(14);
    expect(t.totalTokensOutput).toBe(8);
    expect(t.gitCommitHashes.sort()).toEqual(['abc', 'def']);
    expect(t.approvals[0].decision).toBe('approved');
    expect(rows[0].payloadParsed).toEqual({ intent: 'やる' });
  });

  it('flags payload parse errors without throwing', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([
      auditRecord({ payload: '{not-valid-json' }),
    ] as any);

    const { rows } = await collectAuditRows({});

    expect(rows[0].payloadParseError).toBe(true);
    expect(rows[0].payloadParsed).toBeNull();
    // no workflowExecution query when no traceId present
    expect(prisma.workflowExecution.findMany).not.toHaveBeenCalled();
  });

  it('reports truncation when row count exceeds maxRows', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([
      auditRecord({ id: 'a' }),
      auditRecord({ id: 'b' }),
      auditRecord({ id: 'c' }),
    ] as any);

    const { rows, truncated } = await collectAuditRows({}, 2);

    expect(rows).toHaveLength(2);
    expect(truncated).toBe(true);
  });
});

describe('renderAuditCsv', () => {
  it('produces BOM + Japanese headers + enriched columns', () => {
    const rows: EnrichedAuditRow[] = [
      {
        ...auditRecord({ traceId: 'trace-1', payload: '{"intent":"理由X"}' }),
        payloadParsed: { intent: '理由X' },
        payloadParseError: false,
        trace: {
          flowId: 'flow-x',
          workflowStatus: 'completed',
          llmModelsUsed: ['gpt-4'],
          totalTokensInput: 10,
          totalTokensOutput: 5,
          gitCommitHashes: ['abc'],
          approvals: [{ decision: 'approved', decidedBy: 'boss', reason: 'OK', decidedAt: null }],
          langfuseTraceUrl: 'https://lf/trace/trace-1',
        },
      },
    ];

    const csv = renderAuditCsv(rows);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(csv).toContain('理由・意図');
    expect(csv).toContain('理由X');
    expect(csv).toContain('gpt-4');
    expect(csv).toContain('10/5');
    expect(csv).toContain('approved');
    expect(csv).toContain('https://lf/trace/trace-1');
  });

  it('neutralizes formula injection from payload-derived cells', () => {
    const rows: EnrichedAuditRow[] = [
      {
        ...auditRecord({ payload: '{"intent":"=cmd()"}' }),
        payloadParsed: { intent: '=cmd()' },
        payloadParseError: false,
      },
    ];
    const csv = renderAuditCsv(rows);
    expect(csv).toContain("'=cmd()");
  });
});

describe('renderAuditHtml', () => {
  it('includes header, summary and detail sections', () => {
    const rows: EnrichedAuditRow[] = [
      { ...auditRecord(), payloadParsed: null, payloadParseError: false },
    ];
    const html = renderAuditHtml(rows, { actor: 'admin' }, 'admin', {
      generatedAt: new Date('2026-01-15T03:00:00Z'),
    });
    expect(html).toContain('FlowOps 監査レポート');
    expect(html).toContain('サマリー');
    expect(html).toContain('PROPOSAL_GENERATE');
    expect(html).toContain('操作者: admin');
  });

  it('escapes HTML in dynamic content', () => {
    const rows: EnrichedAuditRow[] = [
      {
        ...auditRecord({ actor: '<script>x</script>' }),
        payloadParsed: null,
        payloadParseError: false,
      },
    ];
    const html = renderAuditHtml(rows, {}, 'admin');
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows truncation warning when truncated', () => {
    const rows: EnrichedAuditRow[] = [
      { ...auditRecord(), payloadParsed: null, payloadParseError: false },
    ];
    const html = renderAuditHtml(rows, {}, 'admin', { truncated: true, maxRows: 10000 });
    expect(html).toContain('上限');
  });
});
