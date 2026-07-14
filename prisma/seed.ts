/**
 * FlowOps - Database Seed
 *
 * 初期管理者ユーザー + サンプルデータを作成
 * 冪等: 既存データがあればスキップ
 */

import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';

// Prisma 7 はドライバアダプタ必須。src/lib/prisma.ts と同じ構築方法を使う。
// DATABASE_URL 未設定時は SQLite (prisma/dev.db) にフォールバック。
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
  if (!url.startsWith('file:')) {
    throw new Error('FlowOps MVP supports SQLite only. DATABASE_URL must start with "file:".');
  }
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

async function main() {
  // ─── Admin User ───────────────────────────────────────
  const email = process.env.FLOWOPS_ADMIN_EMAIL || 'admin@flowops.local';
  const password =
    process.env.FLOWOPS_ADMIN_PASSWORD ||
    (process.env.NODE_ENV === 'production' ? undefined : 'admin');

  if (!password) {
    throw new Error('FLOWOPS_ADMIN_PASSWORD is required when seeding in production.');
  }
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      hashedPassword,
      role: 'admin',
    },
    create: {
      email,
      name: 'Admin',
      hashedPassword,
      role: 'admin',
    },
  });
  console.log(`Ensured admin user: ${user.email} (${user.id})`);

  // ─── Sample Issues ───────────────────────────────────
  const issues = [
    {
      humanId: 'ISS-001',
      title: '受注処理フローの在庫確認ステップにSLA追加',
      description:
        '受注処理フロー（order-process）の在庫確認ステップに、24時間以内に確認完了するSLAルールを追加してください。',
      status: 'new',
      targetFlowId: 'order-process',
    },
    {
      humanId: 'ISS-002',
      title: '出荷フローのピッキング手順を明確化',
      description:
        '出荷処理フロー（shipping-process）のピッキングステップの手順が曖昧なため、具体的な作業手順を記載してください。',
      status: 'in-progress',
      targetFlowId: 'shipping-process',
      branchName: 'cr/ISS-002-picking-clarify',
    },
    {
      humanId: 'ISS-003',
      title: '問い合わせ対応フローに担当者自動割り当て追加',
      description:
        '問い合わせ対応フロー（inquiry-handling）に、問い合わせ種別に応じて担当者を自動割り当てするステップを追加してください。',
      status: 'proposed',
      targetFlowId: 'inquiry-handling',
    },
  ];

  for (const issueData of issues) {
    const existingIssue = await prisma.issue.findUnique({
      where: { humanId: issueData.humanId },
    });
    if (existingIssue) {
      console.log(`Issue ${issueData.humanId} already exists, skipping.`);
      continue;
    }

    const issue = await prisma.issue.create({ data: issueData });
    console.log(`Created issue: ${issue.humanId} - ${issue.title}`);

    // ─── AuditLog for each Issue ──────────────────────
    await prisma.auditLog.create({
      data: {
        actor: email,
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: issue.id,
        payload: JSON.stringify({
          humanId: issue.humanId,
          title: issue.title,
          targetFlowId: issue.targetFlowId,
        }),
      },
    });
    console.log(`Created audit log for ${issue.humanId}`);

    // ─── Proposal for ISS-003 ─────────────────────────
    if (issueData.humanId === 'ISS-003') {
      await prisma.proposal.create({
        data: {
          issueId: issue.id,
          intent: '問い合わせ種別（技術/営業/一般）に基づく担当者自動割り当てノードを追加',
          jsonPatch: JSON.stringify([
            {
              op: 'add',
              path: '/nodes/auto_assign',
              value: {
                id: 'auto_assign',
                type: 'process',
                label: '担当者自動割り当て',
                role: 'support',
                system: 'crm',
              },
            },
            {
              op: 'add',
              path: '/edges/e_to_assign',
              value: {
                id: 'e_to_assign',
                from: 'receive_inquiry',
                to: 'auto_assign',
              },
            },
          ]),
          diffPreview:
            '+ nodes.auto_assign: 担当者自動割り当て (process)\n+ edges.e_to_assign: receive_inquiry → auto_assign',
          targetFlowId: 'inquiry-handling',
          isApplied: false,
        },
      });
      console.log(`Created proposal for ${issue.humanId}`);
    }
  }

  console.log('\nSeed completed successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
