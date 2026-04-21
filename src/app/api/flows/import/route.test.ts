import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('next/server', () => ({
  NextRequest: class {},
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

vi.mock('@/core/audit/logger', () => ({
  auditLog: {
    record: vi.fn(),
  },
}));

vi.mock('@/lib/flow-service', () => ({
  getFlowYaml: vi.fn(),
  saveFlowYaml: vi.fn(),
}));

import { auditLog } from '@/core/audit/logger';
import { getFlowYaml, saveFlowYaml } from '@/lib/flow-service';

function getBody(result: any) {
  return result.body as any;
}

function makeRequest(body: unknown, validate = false) {
  return {
    json: async () => body,
    nextUrl: new URL(`http://localhost/api/flows/import${validate ? '?validate=true' : ''}`),
  } as any;
}

const VALID_YAML = [
  'id: order-process',
  'title: Order Process',
  'layer: L1',
  'updatedAt: "2026-04-19T00:00:00.000Z"',
  'nodes:',
  '  start_node:',
  '    id: start_node',
  '    type: start',
  '    label: Start',
  '  end_node:',
  '    id: end_node',
  '    type: end',
  '    label: End',
  'edges:',
  '  e1:',
  '    id: e1',
  '    from: start_node',
  '    to: end_node',
].join('\n');

describe('POST /api/flows/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates a normal flow YAML successfully', async () => {
    const result = await POST(makeRequest({ yaml: VALID_YAML }, true));
    const body = getBody(result);

    expect(result.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.valid).toBe(true);
    expect(body.data.errors).toEqual([]);
  });

  it('rejects overwrite when body flowId mismatches YAML id', async () => {
    const result = await POST(
      makeRequest({ yaml: VALID_YAML, flowId: 'shipping-process', overwrite: true })
    );
    const body = getBody(result);

    expect(result.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(saveFlowYaml).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('saves when YAML id matches the target flow id', async () => {
    vi.mocked(getFlowYaml).mockResolvedValueOnce('existing');

    const result = await POST(
      makeRequest({ yaml: VALID_YAML, flowId: 'order-process', overwrite: true })
    );
    const body = getBody(result);

    expect(result.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(saveFlowYaml).toHaveBeenCalledWith('order-process', VALID_YAML);
    expect(auditLog.record).toHaveBeenCalledOnce();
  });
});
