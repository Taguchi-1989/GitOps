import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock PrismaClient before importing the module
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  })),
}));

describe('prisma', () => {
  beforeEach(() => {
    vi.resetModules();
    // Clean up globalThis between tests
    const g = globalThis as unknown as { prisma: unknown };
    delete g.prisma;
  });

  it('should export a defined prisma instance', async () => {
    const { prisma } = await import('@/lib/prisma');
    expect(prisma).toBeDefined();
  });

  it('should create a PrismaClient instance', async () => {
    const { PrismaClient } = await import('@prisma/client');
    await import('@/lib/prisma');
    expect(PrismaClient).toHaveBeenCalled();
  });

  it('should store prisma on globalThis in non-production env', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'test';

    const { prisma } = await import('@/lib/prisma');
    const g = globalThis as unknown as { prisma: unknown };
    expect(g.prisma).toBe(prisma);

    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });
});
