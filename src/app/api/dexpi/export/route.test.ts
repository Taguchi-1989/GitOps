import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleDexpiDocument } from '@/core/dexpi/test-fixtures';
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

describe('POST /api/dexpi/export', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exports canonical JSON as DeXPI XML 2.0', async () => {
    const result = await POST(request({ format: 'dexpi-xml', document: sampleDexpiDocument() }));
    const body = (result as any).body;
    expect(result.status).toBe(200);
    expect(body.data.fileName).toBe('SamplePid.xml');
    expect(body.data.mimeType).toBe('application/xml');
    expect(body.data.content).toContain('<Model name="SamplePid"');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEXPI_EXPORT', entityType: 'DexpiDocument' })
    );
  });

  it('rejects a semantically dangling object reference', async () => {
    const document = sampleDexpiDocument();
    document.objects.tank_1.references.FlowTo = ['#missing'];
    const result = await POST(request({ format: 'dexpi-xml', document }));
    const body = (result as any).body;
    expect(result.status).toBe(400);
    expect(body.details).toContain('does not exist');
    expect(auditLog.record).not.toHaveBeenCalled();
  });
});
