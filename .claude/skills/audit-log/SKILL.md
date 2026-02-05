---
name: Audit Logger
description: すべての操作の監査ログを記録・照会するスキル。"誰が/いつ/何を/なぜ"を追跡可能にする。
---

# Audit Logger Skill

## 概要

このスキルは FlowOps プロジェクトにおける全ての状態遷移を記録します。
運用の安定性と問題追跡を支援します。

## 責務

1. **ログ記録**
   - Issue/Proposal/Git操作のすべてを記録
   - タイムスタンプ、アクター、アクション、対象を保存

2. **ログ照会**
   - 時系列での履歴表示
   - エンティティ単位でのフィルタリング

## Prismaスキーマ追加

```prisma
model AuditLog {
  id         String   @id @default(cuid())

  actor      String   @default("you")  // MVP: 固定
  action     String   // ISSUE_CREATE, PROPOSAL_GENERATE, etc.

  entityType String   // Issue, Proposal, Flow
  entityId   String

  payload    Json?    // 差分や理由など

  createdAt  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([action])
  @@index([createdAt])
}
```

## アクション一覧

| アクション          | 説明             | payload例                    |
| ------------------- | ---------------- | ---------------------------- |
| `ISSUE_CREATE`      | Issue作成        | `{ title, targetFlowId }`    |
| `ISSUE_UPDATE`      | Issue更新        | `{ before, after }`          |
| `ISSUE_START`       | 作業着手         | `{ branchName }`             |
| `PROPOSAL_GENERATE` | 提案生成         | `{ baseHash, intent }`       |
| `PATCH_APPLY`       | パッチ適用       | `{ proposalId, patchCount }` |
| `MERGE_CLOSE`       | マージ完了       | `{ branchName }`             |
| `DUPLICATE_MERGE`   | 重複統合         | `{ canonicalId }`            |
| `GIT_COMMIT`        | コミット         | `{ commitHash, message }`    |
| `GIT_BRANCH_CREATE` | ブランチ作成     | `{ branchName }`             |
| `GIT_BRANCH_DELETE` | ブランチ削除     | `{ branchName }`             |
| `BACKUP_CREATE`     | バックアップ作成 | `{ type, path }`             |

## 実装パス

```
core/
├── audit/
│   ├── logger.ts     # ログ記録
│   ├── types.ts      # アクション型定義
│   └── query.ts      # ログ照会
lib/
└── audit.ts          # シングルトン export
```

## 使用例

```typescript
import { auditLog } from "@/lib/audit";

// ログ記録
await auditLog.record({
  action: "ISSUE_CREATE",
  entityType: "Issue",
  entityId: issue.id,
  payload: { title: issue.title, targetFlowId: issue.targetFlowId },
});

// ログ照会
const logs = await auditLog.query({
  entityType: "Issue",
  entityId: "clx...",
  limit: 50,
});
```

## UI統合

Issue詳細画面に「履歴タブ」を追加し、該当Issueに関連する全AuditLogを時系列で表示する。
