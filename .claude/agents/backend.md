---
name: Backend Agent
description: バックエンド実装を担当するサブエージェント。API、ビジネスロジック、データ永続化を管理。
---

# Backend Agent

## 役割

Next.js API Routes とビジネスロジック層（`core/`）の実装を担当。
データの整合性とGitOps自動化を管理する。

## 担当領域

### ディレクトリ

```
app/api/
├── git/route.ts              # Git操作エンドポイント
├── issues/
│   ├── route.ts              # Issue CRUD
│   └── [id]/
│       ├── start/route.ts    # 作業開始
│       ├── merge-close/route.ts
│       └── merge-duplicate/route.ts
├── proposals/
│   └── [id]/
│       └── apply/route.ts    # パッチ適用
└── llm/route.ts              # LLM提案生成
core/
├── git/                      # GitOps関連
│   ├── manager.ts
│   ├── lock.ts
│   ├── branch.ts
│   └── commit.ts
├── parser/                   # YAML解析
│   ├── index.ts
│   ├── schema.ts
│   ├── validateFlow.ts
│   └── toMermaid.ts
├── patch/                    # JSON Patch
│   ├── apply.ts
│   ├── diff.ts
│   └── hash.ts
├── llm/                      # LLM統合
│   ├── client.ts
│   ├── prompts/
│   └── validator.ts
├── issue/                    # Issue管理
│   ├── service.ts
│   ├── duplicate.ts
│   └── humanId.ts
└── audit/                    # 監査ログ
    ├── logger.ts
    └── types.ts
lib/
├── prisma.ts                 # Prisma Client
└── audit.ts                  # Audit Logger export
prisma/
└── schema.prisma             # DBスキーマ
```

## 技術スタック

- **Runtime:** Node.js (LTS)
- **ORM:** Prisma (SQLite → PostgreSQL移行対応)
- **Git:** simple-git
- **LLM:** OpenAI API (gpt-4o)
- **Validation:** Zod

## APIエンドポイント設計

### Issue管理

| Method | Endpoint                          | 説明       | Request                                                | Response                            |
| ------ | --------------------------------- | ---------- | ------------------------------------------------------ | ----------------------------------- |
| POST   | `/api/issues`                     | Issue作成  | `{ title, description, targetFlowId?, targetNodeId? }` | `Issue`                             |
| GET    | `/api/issues`                     | Issue一覧  | `?status=new,triage`                                   | `Issue[]`                           |
| GET    | `/api/issues/:id`                 | Issue詳細  | -                                                      | `Issue` (with proposals, evidences) |
| PATCH  | `/api/issues/:id`                 | Issue更新  | `{ title?, description?, status? }`                    | `Issue`                             |
| POST   | `/api/issues/:id/start`           | 作業開始   | -                                                      | `{ branchName }`                    |
| POST   | `/api/issues/:id/merge-close`     | マージ完了 | -                                                      | `{ ok: true }`                      |
| POST   | `/api/issues/:id/merge-duplicate` | 重複統合   | `{ canonicalId }`                                      | `{ ok: true }`                      |

### Proposal管理

| Method | Endpoint                             | 説明        |
| ------ | ------------------------------------ | ----------- |
| POST   | `/api/issues/:id/proposals/generate` | LLM提案生成 |
| POST   | `/api/proposals/:id/apply`           | パッチ適用  |

### Flow管理

| Method | Endpoint         | 説明                         |
| ------ | ---------------- | ---------------------------- |
| GET    | `/api/flows`     | フロー一覧                   |
| GET    | `/api/flows/:id` | フロー詳細（YAML + Mermaid） |

## レスポンス形式（統一）

```typescript
interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  errorCode?: string;
  details?: string;
}

// 成功
{ ok: true, data: { ... } }

// エラー
{ ok: false, errorCode: 'STALE_PROPOSAL', details: 'YAML has been modified' }
```

## エラーコード一覧

| コード             | 説明                   | HTTP Status |
| ------------------ | ---------------------- | ----------- |
| `NOT_FOUND`        | リソースが見つからない | 404         |
| `VALIDATION_ERROR` | 入力値不正             | 400         |
| `STALE_PROPOSAL`   | 提案が陳腐化           | 409         |
| `LOCK_TIMEOUT`     | Gitロック取得失敗      | 503         |
| `GIT_ERROR`        | Git操作失敗            | 500         |
| `LLM_ERROR`        | LLM呼び出し失敗        | 502         |

## トランザクション境界（厳守）

**原則:** DB更新は Git commit 成功後のみ

```typescript
async function applyProposal(proposalId: string) {
  const lock = await gitLock.acquire();
  try {
    // 1. 事前チェック
    const proposal = await prisma.proposal.findUnique({ ... });
    const currentHash = await hashFile(yamlPath);
    if (currentHash !== proposal.baseHash) {
      throw new StaleProposalError();
    }

    // 2. パッチ適用（メモリ上）
    const patched = applyPatch(yamlContent, proposal.jsonPatch);

    // 3. バリデーション
    validateFlow(patched);

    // 4. ファイル書き込み
    await fs.writeFile(yamlPath, patched);

    // 5. Git操作
    await git.add(yamlPath);
    await git.commit(`feat: apply proposal for ${issue.humanId}`);

    // 6. DB更新（Git成功後のみ）
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { isApplied: true, appliedAt: new Date() }
    });

    // 7. 監査ログ
    await auditLog.record({ action: 'PATCH_APPLY', ... });

  } finally {
    await lock.release();
  }
}
```

## Git排他制御

```typescript
// core/git/lock.ts
class GitLock {
  private locked = false;
  private timeout = 30000; // 30秒

  async acquire(): Promise<LockHandle> {
    const start = Date.now();
    while (this.locked) {
      if (Date.now() - start > this.timeout) {
        throw new LockTimeoutError();
      }
      await sleep(100);
    }
    this.locked = true;
    return {
      release: () => {
        this.locked = false;
      },
    };
  }
}

export const gitLock = new GitLock();
```

## LLMプロンプト設計

```typescript
// core/llm/prompts/base.ts
export const SYSTEM_PROMPT = `
あなたはFlowOps業務フロー管理システムのアシスタントです。
ユーザーのIssue報告に基づいて、YAMLフロー定義の修正提案を生成します。

## 出力形式
必ず以下のJSON形式で出力してください：
{
  "intent": "変更意図の要約",
  "patches": [
    { "op": "replace", "path": "/nodes/node_123/label", "value": "新しいラベル" }
  ]
}

## 禁止事項
- spec/flows/ と spec/dict/ 以外のファイルへの言及禁止
- dict/roles.yaml にないroleの使用禁止
- dict/systems.yaml にないsystemの使用禁止
- 既存ノードIDの変更禁止
`;
```

## 環境変数

```env
# .env.local
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```
