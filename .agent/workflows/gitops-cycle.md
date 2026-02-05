---
description: Issue着手からマージ完了までのGitOpsサイクル
---

# GitOps サイクル ワークフロー

## 概要

Issue着手→提案生成→適用→マージ完了 の一連の流れを実行するワークフロー。

## フェーズ1: 作業着手

### 1. ブランチ作成

```bash
git checkout -b cr/{ISSUE_ID}-{slug}
```

例: `git checkout -b cr/ISS-001-fix-typo`

### 2. DB更新

```typescript
await prisma.issue.update({
  where: { id: issueId },
  data: {
    status: "in-progress",
    branchName: `cr/${issueId}-${slug}`,
  },
});
```

## フェーズ2: 提案生成

### 1. 対象YAMLの読み込み

```typescript
const yamlContent = await fs.readFile(
  `spec/flows/${targetFlowId}.yaml`,
  "utf-8",
);
const baseHash = sha256(yamlContent);
```

### 2. LLM呼び出し

```typescript
const proposal = await llmClient.generateProposal({
  issue: issueData,
  yaml: yamlContent,
  dict: dictionaryData,
});
```

### 3. Proposal保存

```typescript
await prisma.proposal.create({
  data: {
    issueId,
    intent: proposal.intent,
    jsonPatch: proposal.patches,
    baseHash,
  },
});
```

## フェーズ3: パッチ適用

### 事前チェック（必須）

```typescript
// baseHashの確認
const currentHash = sha256(await fs.readFile(yamlPath, "utf-8"));
if (currentHash !== proposal.baseHash) {
  throw new Error("STALE_PROPOSAL");
}
```

### 適用順序（厳守）

1. パッチ適用（メモリ上）
2. Zodバリデーション
3. 参照整合性チェック
4. ファイル書き込み
5. `git add .`
6. `git commit -m "feat: apply proposal for {ISSUE_ID}"`
7. **ここで初めて** DB更新（`Proposal.isApplied = true`）

### コミット

```bash
git add spec/flows/{targetFlowId}.yaml
git commit -m "feat: apply proposal for {ISSUE_ID}"
```

## フェーズ4: マージ完了

### 1. mainにマージ

```bash
git checkout main
git merge cr/{ISSUE_ID}-{slug}
```

### 2. ブランチ削除

```bash
git branch -d cr/{ISSUE_ID}-{slug}
```

### 3. DB更新

```typescript
await prisma.issue.update({
  where: { id: issueId },
  data: { status: "merged" },
});
```

## エラー時の対応

| エラー              | 対応                         |
| ------------------- | ---------------------------- |
| `STALE_PROPOSAL`    | 提案を再生成                 |
| `VALIDATION_FAILED` | パッチを修正して再適用       |
| `GIT_COMMIT_FAILED` | DBは更新せず、状態をチェック |
| `MERGE_CONFLICT`    | 手動解決後に再実行           |
