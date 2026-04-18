import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, status: init?.status || 200 })),
  },
}));

vi.mock('@/lib/data-object-repository', () => ({
  dataObjectRepository: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/core/audit/logger', () => ({
  auditLog: { logDataAction: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { dataObjectRepository } from '@/lib/data-object-repository';
import { GET, POST } from './route';

function getBody(result: unknown): Record<string, unknown> {
  return (result as { body: Record<string, unknown> }).body;
}

function getStatus(result: unknown): number {
  return (result as { status: number }).status;
}

const now = new Date();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/data-objects', () => {
  it('should create a DataObject', async () => {
    const record = {
      id: 'cuid-001',
      objectId: 'obj-001',
      objectType: 'document',
      sensitivityLevel: 'L2',
      createdAt: now,
      updatedAt: now,
    };
    vi.mocked(dataObjectRepository.create).mockResolvedValueOnce(record as never);

    const request = new Request('http://localhost/api/data-objects', {
      method: 'POST',
      body: JSON.stringify({
        objectId: 'obj-001',
        objectType: 'document',
        sensitivityLevel: 'L2',
        createdAt: '2026-03-09T10:00:00+09:00',
        updatedAt: '2026-03-09T10:00:00+09:00',
      }),
    });

    const result = await POST(request);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    expect(getStatus(result)).toBe(201);
    expect(dataObjectRepository.create).toHaveBeenCalledOnce();
  });

  it('should reject invalid body', async () => {
    const request = new Request('http://localhost/api/data-objects', {
      method: 'POST',
      body: JSON.stringify({ invalid: true }),
    });

    const result = await POST(request);
    const body = getBody(result);

    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/data-objects', () => {
  it('should return data objects with pagination', async () => {
    const records = [{ id: 'cuid-1', objectId: 'obj-001', objectType: 'document' }];
    vi.mocked(dataObjectRepository.findMany).mockResolvedValueOnce(records as never);
    vi.mocked(dataObjectRepository.count).mockResolvedValueOnce(1 as never);

    const request = new Request('http://localhost/api/data-objects?objectType=document&limit=10');

    const result = await GET(request);
    const body = getBody(result);

    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.dataObjects).toHaveLength(1);
    expect((data.pagination as Record<string, unknown>).total).toBe(1);
  });

  it('should filter by sensitivityLevel', async () => {
    vi.mocked(dataObjectRepository.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(dataObjectRepository.count).mockResolvedValueOnce(0 as never);

    const request = new Request('http://localhost/api/data-objects?sensitivityLevel=L3');
    await GET(request);

    expect(dataObjectRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ sensitivityLevel: 'L3' })
    );
  });
});
