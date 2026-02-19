/**
 * FlowOps - Database Seed
 *
 * 初期管理者ユーザーを作成
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@flowops.local';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`User ${email} already exists, skipping seed.`);
    return;
  }

  const hashedPassword = await bcrypt.hash('admin', 12);

  const user = await prisma.user.create({
    data: {
      email,
      name: 'Admin',
      hashedPassword,
      role: 'admin',
    },
  });

  console.log(`Created admin user: ${user.email} (${user.id})`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
