---
description: Issue重複統合の実行手順
---

# Issue 重複統合ワークフロー

## 概要

Issue B を Issue A に統合する際の手順。
「同じような指摘」が複数来た場合に使用する。

## 前提条件

- Issue A（統合先・Canonical）が存在すること
- Issue B（統合元・Duplicate）が `merged` または `merged-duplicate` ではないこと

## 実行手順

### 1. ブランチ状態の確認

Issue B にブランチが存在するか確認:

```typescript
if (issueB.branchName) {
  // ブランチが存在する場合は次のステップへ
} else {
  // ブランチがない場合はステップ3へスキップ
}
```

### 2. コミットの有無を確認

```bash
git log main..cr/{ISSUE_B_ID} --oneline
```

#### コミットがある場合

Issue B のブランチにコミットがある場合、Issue A へ cherry-pick:

```bash
# Issue A のブランチに切り替え
git checkout cr/{ISSUE_A_ID}

# Issue B のコミットを cherry-pick
git cherry-pick <commit-hash>

# コンフリクトが発生した場合は手動解決
```

#### コミットがない場合

そのままブランチ削除へ進む。

### 3. Issue B のブランチ削除

```bash
git branch -d cr/{ISSUE_B_ID}
```

強制削除が必要な場合（cherry-pick済み）:

```bash
git branch -D cr/{ISSUE_B_ID}
```

### 4. DB更新

```typescript
await prisma.issue.update({
  where: { id: issueBId },
  data: {
    canonicalId: issueAId,
    status: "merged-duplicate",
    branchName: null,
  },
});
```

### 5. 監査ログ記録

```typescript
await auditLog.record({
  action: "DUPLICATE_MERGE",
  entityType: "Issue",
  entityId: issueBId,
  payload: {
    canonicalId: issueAId,
    hadCommits: hasCommits,
    cherryPickedCommits: cherryPickedHashes,
  },
});
```

## UI表示の変更

### Issue B の画面

```
⚠️ このIssueは ISS-001 に統合されました
[ISS-001を表示する] ← リンク

（以降の編集は不可）
```

### Issue A の画面

```
📎 関連するIssue
  - ISS-002（統合済み）← クリックで展開
    - Evidence 1: screenshot.png
    - Evidence 2: error_log.txt
```

## 注意事項

1. **統合は一方向** - 一度統合したら取り消せない
2. **Evidence は引き継ぐ** - Issue B の Evidence は Issue A からも参照可能
3. **cherry-pick コンフリクト** - 自動解決できない場合は警告を出し、手動解決を促す
