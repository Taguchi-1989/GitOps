/**
 * FlowOps - Prisma Client
 *
 * PrismaClient のシングルトンインスタンス
 * Prisma 7 (client/WASM engine) requires an explicit driver adapter.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
