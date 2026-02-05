---
name: LLM Patch Generator
description: LLMを活用したパッチ生成と適用を担当するスキル。安全なプロンプト設計と出力検証を提供。
---

# LLM Patch Generator Skill

## 概要

このスキルは OpenAI API を使用して、Issueに対する修正提案（Proposal）を自動生成します。
安全性と整合性を重視した設計になっています。

## 責務

1. **パッチ生成**
   - Issue内容とYAML定義を元に修正提案を生成
   - JSON Patch形式での差分出力
   - baseHashによる陳腐化検知

2. **出力検証**
   - 生成されたパッチのZodスキーマ検証
   - 禁止事項のチェック

3. **パッチ適用**
   - JSON Patchのメモリ上適用
   - 適用後の整合性検証

## 実装パス

```
core/
├── llm/
│   ├── client.ts          # OpenAI API Client
│   ├── prompts/
│   │   ├── base.ts        # 基本プロンプトテンプレート
│   │   └── constraints.ts # 禁止事項・制約
│   ├── generator.ts       # Proposal生成
│   └── validator.ts       # 出力検証
├── patch/
│   ├── apply.ts           # JSON Patch適用
│   ├── diff.ts            # Diff生成
│   └── hash.ts            # baseHash計算
```

## 環境変数

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o  # 差し替え可能
```

## プロンプト制約（禁止事項）

以下は LLM への指示として必ず含めること：

1. **変更対象の制限**
   - `spec/flows/` と `spec/dict/` 以外のファイル変更禁止
   - `.env`、設定ファイル、パス情報への言及禁止

2. **辞書整合性**
   - `dict/roles.yaml` にないroleを作成禁止
   - `dict/systems.yaml` にないsystemを作成禁止

3. **ID操作の制限**
   - 既存のノードID変更は原則禁止
   - ID変更が必要な場合は別operationとして提案

4. **出力形式**
   - 必ず指定されたJSONスキーマに従うこと
   - 説明文やマークダウンは出力しない

## Proposal出力スキーマ

```typescript
interface ProposalOutput {
  intent: string; // 変更意図の要約
  baseHash: string; // 対象YAMLのハッシュ
  targetFlowId: string; // 対象フローID
  patches: JsonPatch[]; // 変更差分
}

interface JsonPatch {
  op: "add" | "remove" | "replace" | "move";
  path: string; // 例: "/nodes/node_123/label"
  value?: any;
}
```

## baseHash処理

```typescript
// 提案生成時
const baseHash = sha256(yamlContent);
proposal.baseHash = baseHash;

// 適用時
const currentHash = sha256(currentYamlContent);
if (proposal.baseHash !== currentHash) {
  throw new StaleProposalError(
    "YAML has been modified since proposal was generated",
  );
}
```

## エラーコード

| コード               | 説明                         |
| -------------------- | ---------------------------- |
| `INVALID_OUTPUT`     | LLM出力がスキーマ違反        |
| `STALE_PROPOSAL`     | baseHash不一致（再生成必要） |
| `FORBIDDEN_PATH`     | 禁止されたパスへの変更       |
| `UNKNOWN_ROLE`       | 辞書にないroleを使用         |
| `PATCH_APPLY_FAILED` | パッチ適用失敗               |
