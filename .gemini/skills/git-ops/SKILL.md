---
name: GitOps Manager
description: Git操作の自動化とリポジトリ管理を担当するスキル。ブランチ作成、コミット、マージ、ロック機構を提供。
---

# GitOps Manager Skill

## 概要

このスキルは FlowOps プロジェクトにおけるGit操作を自動化・管理するためのものです。
UI操作をGitコマンドに変換し、履歴の透明性と復元性を担保します。

## 責務

1. **ブランチ管理**
   - Issue着手時のブランチ作成: `cr/{ISSUE_ID}-{slug}`
   - 完了時のブランチ削除
   - 重複統合時のcherry-pick処理

2. **コミット操作**
   - パッチ適用後の自動コミット
   - コミットメッセージ規約: `feat: apply proposal for {ISSUE_ID}`

3. **排他制御（Mutex Lock）**
   - Repo単位でのロック機構
   - 同時操作の防止
   - タイムアウト時の自動解除

4. **状態監査**
   - 各Git操作前後の `git status` と `HEAD` の記録
   - 失敗時のロールバック支援

## 実装パス

```
core/
├── git/
│   ├── manager.ts      # SimpleGit Wrapper
│   ├── lock.ts         # Mutex Lock機構
│   ├── branch.ts       # ブランチ操作
│   ├── commit.ts       # コミット操作
│   └── audit.ts        # 操作監査ログ
```

## 使用ライブラリ

- `simple-git`: Git操作のNode.jsラッパー

## 重要ルール

1. **DB更新はcommit成功後のみ** - Git操作が失敗したらDBは一切更新しない
2. **ロック必須** - すべてのMutate操作はロック取得後に実行
3. **監査ログ必須** - すべての操作を AuditLog に記録

## コマンド例

```typescript
// ブランチ作成
await gitManager.createBranch("cr/ISS-001-fix-typo");

// コミット
await gitManager.commitChanges("feat: apply proposal for ISS-001", [
  "spec/flows/order.yaml",
]);

// マージ
await gitManager.mergeAndClose("cr/ISS-001-fix-typo");
```
