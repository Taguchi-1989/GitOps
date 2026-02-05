---
name: Issue Management
description: Issue・Proposal・Evidenceのライフサイクル管理を担当するスキル。状態遷移と重複統合機能を提供。
---

# Issue Management Skill

## 概要

このスキルは FlowOps プロジェクトにおける Issue のライフサイクル全体を管理します。
重複統合（Duplicate Merge）機能を含む堅牢なIssue管理を提供します。

## 責務

1. **Issue CRUD**
   - 作成・読取・更新・削除
   - ステータス遷移管理
   - humanId の自動生成（ISS-001形式）

2. **Proposal管理**
   - LLM生成またはマニュアル入力
   - 適用（Apply）と履歴管理

3. **Evidence管理**
   - スクリーンショット、リンク、テキストログの添付
   - 重複統合時のEvidence引き継ぎ

4. **重複統合（Duplicate Merge）**
   - Issue B を Issue A に統合
   - ブランチのcherry-pick処理

## 実装パス

```
app/
├── api/
│   └── issues/
│       ├── route.ts              # CRUD
│       ├── [id]/
│       │   ├── start/route.ts    # 作業開始
│       │   ├── merge-close/route.ts
│       │   └── merge-duplicate/route.ts
core/
├── issue/
│   ├── service.ts         # ビジネスロジック
│   ├── duplicate.ts       # 重複統合ロジック
│   └── humanId.ts         # ID生成
```

## ステータス遷移

```mermaid
stateDiagram-v2
    [*] --> new: Issue作成
    new --> triage: トリアージ開始
    triage --> in_progress: 作業着手
    in_progress --> proposed: 提案生成
    proposed --> merged: 承認・マージ
    proposed --> rejected: 却下

    new --> merged_duplicate: 重複として統合
    triage --> merged_duplicate: 重複として統合
    in_progress --> merged_duplicate: 重複として統合

    merged --> [*]
    rejected --> [*]
    merged_duplicate --> [*]
```

## ステータス定義

| ステータス         | 説明                     | 次のアクション         |
| ------------------ | ------------------------ | ---------------------- |
| `new`              | 新規作成                 | トリアージ or 重複統合 |
| `triage`           | トリアージ中             | 作業着手 or 重複統合   |
| `in-progress`      | 作業中（ブランチ作成済） | 提案生成               |
| `proposed`         | 提案あり                 | 適用 or 却下           |
| `merged`           | マージ完了               | -                      |
| `rejected`         | 却下                     | -                      |
| `merged-duplicate` | 重複として統合済         | -                      |

## 重複統合ロジック

```typescript
async function mergeDuplicate(duplicateId: string, canonicalId: string) {
  const duplicate = await getIssue(duplicateId);
  const canonical = await getIssue(canonicalId);

  // ブランチにコミットがあるか確認
  if (duplicate.branchName) {
    const hasCommits = await gitManager.hasCommits(duplicate.branchName);

    if (hasCommits) {
      // コミットがある場合は cherry-pick
      await gitManager.cherryPick(duplicate.branchName, canonical.branchName);
    }

    // ブランチ削除
    await gitManager.deleteBranch(duplicate.branchName);
  }

  // DB更新
  await prisma.issue.update({
    where: { id: duplicateId },
    data: {
      canonicalId: canonicalId,
      status: "merged-duplicate",
    },
  });

  // 監査ログ
  await auditLog.record({
    action: "DUPLICATE_MERGE",
    entityType: "Issue",
    entityId: duplicateId,
    payload: { canonicalId },
  });
}
```

## API エンドポイント

| メソッド | パス                                 | 説明                     |
| -------- | ------------------------------------ | ------------------------ |
| POST     | `/api/issues`                        | Issue作成                |
| GET      | `/api/issues`                        | Issue一覧                |
| GET      | `/api/issues/:id`                    | Issue詳細                |
| PATCH    | `/api/issues/:id`                    | Issue更新                |
| POST     | `/api/issues/:id/start`              | 作業開始（ブランチ作成） |
| POST     | `/api/issues/:id/proposals/generate` | 提案生成                 |
| POST     | `/api/proposals/:id/apply`           | 提案適用                 |
| POST     | `/api/issues/:id/merge-close`        | マージ＆クローズ         |
| POST     | `/api/issues/:id/merge-duplicate`    | 重複統合                 |

## レスポンス形式

```typescript
interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  errorCode?: string;
  details?: string;
}
```
