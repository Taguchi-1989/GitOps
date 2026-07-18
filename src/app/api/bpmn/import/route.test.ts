import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: vi.fn((body, init) => ({ body, status: init?.status || 200 })) },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/core/audit/logger', () => ({
  auditLog: { record: vi.fn().mockResolvedValue(null) },
}));

import { auditLog } from '@/core/audit/logger';

function request(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers({ 'x-actor-id': 'editor@example.com' }),
  } as any;
}

describe('POST /api/bpmn/import', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converts annotated Mermaid to canonical BPMN JSON', async () => {
    const result = await POST(
      request({
        format: 'mermaid',
        content:
          'flowchart LR\n  start(("Start")):::start\n  review["Review"]:::user\n  endNode(("End")):::end\n  start --> review\n  review --> endNode',
      })
    );
    const body = (result as any).body;
    expect(result.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.document.processes[0].nodes.review.type).toBe('userTask');
    expect(body.data.mermaid).toContain('%% bpmn:process');
    expect(body.data.llmPrompt).toContain('Mermaidスイムレーン・フローチャート');
    expect(body.data.llmPrompt).toContain('"schemaVersion": "flowops-bpmn.v1"');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BPMN_IMPORT', entityType: 'BpmnDocument' })
    );
  });

  it('rejects malformed BPMN XML', async () => {
    const result = await POST(request({ format: 'bpmn-xml', content: '<definitions>' }));
    const body = (result as any).body;
    expect(result.status).toBe(400);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(auditLog.record).not.toHaveBeenCalled();
  });
});
