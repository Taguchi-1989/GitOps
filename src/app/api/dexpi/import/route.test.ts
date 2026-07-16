import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: vi.fn((body, init) => ({ body, status: init?.status || 200 })),
  },
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

describe('POST /api/dexpi/import', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converts annotated Mermaid to canonical JSON and a derived Mermaid view', async () => {
    const result = await POST(
      request({
        format: 'mermaid',
        content: 'flowchart LR\n  tank["T-101"]:::tank\n  pump["P-101"]:::pump\n  tank --> pump',
      })
    );
    const body = (result as any).body;
    expect(result.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.document.objects.pump.type).toBe('Plant/ProcessEquipment.Pump');
    expect(body.data.mermaid).toContain('tank -->|"FlowTo"| pump');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEXPI_IMPORT', entityType: 'DexpiDocument' })
    );
  });

  it('rejects legacy Proteus XML with an actionable message', async () => {
    const result = await POST(
      request({ format: 'dexpi-xml', content: '<PlantModel><PlantInformation/></PlantModel>' })
    );
    const body = (result as any).body;
    expect(result.status).toBe(400);
    expect(body.details).toContain('DEXPI 1.4 Proteus XML');
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('rejects malformed canonical JSON', async () => {
    const result = await POST(request({ format: 'json', content: '{' }));
    const body = (result as any).body;
    expect(result.status).toBe(400);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });
});
