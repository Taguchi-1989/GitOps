import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBpmnDocument } from '@/core/bpmn/test-fixtures';
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

describe('POST /api/bpmn/export', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exports canonical JSON as BPMN 2.0 XML', async () => {
    const result = await POST(request({ format: 'bpmn-xml', document: createBpmnDocument() }));
    const body = (result as any).body;
    expect(result.status).toBe(200);
    expect(body.data.fileName).toBe('Process_Order.bpmn');
    expect(body.data.mimeType).toBe('application/xml');
    expect(body.data.content).toContain('<bpmn:process id="Process_Order"');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BPMN_EXPORT', entityType: 'BpmnDocument' })
    );
  });

  it('exports a paste-ready LLM swimlane prompt', async () => {
    const result = await POST(request({ format: 'llm-prompt', document: createBpmnDocument() }));
    const body = (result as any).body;

    expect(result.status).toBe(200);
    expect(body.data.fileName).toBe('Process_Order.md');
    expect(body.data.mimeType).toBe('text/markdown');
    expect(body.data.content).toContain('Mermaidスイムレーン・フローチャート');
    expect(body.data.content).toContain('"schemaVersion": "flowops-bpmn.v1"');
  });

  it('rejects a dangling sequence-flow reference', async () => {
    const document = createBpmnDocument();
    document.processes[0].sequenceFlows.Flow_End.targetRef = 'Missing_End';
    const result = await POST(request({ format: 'bpmn-xml', document }));
    const body = (result as any).body;
    expect(result.status).toBe(400);
    expect(body.details).toContain('does not exist');
    expect(auditLog.record).not.toHaveBeenCalled();
  });
});
