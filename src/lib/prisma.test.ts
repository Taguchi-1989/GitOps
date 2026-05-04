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

  it('should reuse an existing global prisma instance', async () => {
    const existing = { $disconnect: vi.fn() };
    const g = globalThis as unknown as { prisma: unknown };
    g.prisma = existing;

    const { prisma } = await import('@/lib/prisma');

    expect(prisma).toBe(existing);
  });

  it('should store prisma on globalThis in non-production env', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'test';

    const { prisma } = await import('@/lib/prisma');
    const g = globalThis as unknown as { prisma: unknown };
    expect(g.prisma).toBe(prisma);

    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  it('should not store prisma on globalThis in production env', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';

    await import('@/lib/prisma');
    const g = globalThis as unknown as { prisma: unknown };
    expect(g.prisma).toBeUndefined();

    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });
});
