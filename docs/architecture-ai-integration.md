# 次世代AI統合基盤 統合アーキテクチャ設計書

## 1. 概要

本ドキュメントは、FlowOps（GitOpsベースの業務フロー管理システム）を基盤とし、Gemini_request.mdで定義された5層疎結合アーキテクチャを統合実装するための設計書である。

### 1.1 目的
- 生成AIの技術進化を迅速に取り込む統合基盤の構築
- ベンダーロックインの完全排除
- ISO/IEC 42001準拠のHuman-in-the-loopとトレーサビリティの担保
- マクロ（全体フロー）とミクロ（個別タスク）のGitOps管理

### 1.2 主要設計判断

| 判断事項 | 決定 | 理由 |
|---------|------|------|
| オーケストレーション言語 | TypeScript（LangGraph不採用） | コードベースが100% TypeScript。Python追加は運用複雑化。YAMLフロー定義が既にステートマシン構造を持つ |
| LiteLLM統合方式 | 既存LLMClientのbaseURLを転送 | コード変更最小。環境変数のみで切替可能 |
| DB | PostgreSQL（SQLiteから移行） | JSON列、Langfuse連携、本番運用に必要 |
| マクロ↔ミクロ接続 | NodeSchemaのtaskIdフィールド | フローノードがspec/tasks/のタスク定義を直接参照 |

## 2. 5層アーキテクチャ

```
Layer 1: UI層 (Single Window)
  └── FlowOps Next.js UI + ワークフロー実行/承認UI

Layer 2: ビジネスロジック・オーケストレーション層
  ├── WorkflowEngine（TypeScript ステートマシン）
  ├── MicroTask Loader（Git管理タスクの動的読込）
  └── FlowOps Core（Issue/Proposal/Git/Audit）

Layer 3: LLMゲートウェイ・抽象化層
  └── LiteLLM（Docker、自己ホスト）

Layer 4: LLM推論・インフラ層
  ├── 商用API（OpenAI/Anthropic/Gemini via LiteLLM）
  └── Ollama（ローカルGPU、オプション）

Layer 5: ガバナンス・LLMOps層
  ├── Langfuse（トレース収集・コスト分析）
  ├── FlowOps AuditLogger（Trace ID付き監査ログ）
  └── PostgreSQL（ガバナンスDB）
```

## 3. マクロ↔ミクロ統合

### 3.1 マクロ管理（spec/flows/*.yaml）
- 全体の業務フロー構造をYAMLで定義
- ノードとエッジによるステートマシン構造
- Record形式（配列でない）でJSON Patchの安定性を確保

### 3.2 ミクロ管理（spec/tasks/*.yaml）
- 個別のLLMタスク、データ変換、承認フローを定義
- 入出力スキーマ（JSON Schema形式）による型契約
- セマンティックバージョニングによるバージョン管理

### 3.3 動的結合メカニズム
1. ワークフロー開始時にspec/flows/からYAMLを読込
2. 各ノードのtaskId参照を解決（spec/tasks/から読込）
3. 読込時のGitコミットハッシュをTaskExecutionに記録
4. 実行中のタスクファイル変更はスナップショット分離で安全

## 4. Trace ID伝播

```
リクエスト → Middleware (UUID v4生成)
  → X-Trace-Idヘッダー設定
  → AsyncLocalStorageに格納
  → AuditLogger自動注入
  → LLMClient → LiteLLM → Langfuse
  → WorkflowExecution.traceId
  → TaskExecution.traceId
  → ApprovalRequest → Audit Log
```

## 5. データモデル

### 新規モデル
- **WorkflowExecution**: ワークフロー実行状態、stateData(JSON)
- **TaskExecution**: タスク実行記録、LLMモデル・トークン使用量・Gitハッシュ
- **ApprovalRequest**: Human-in-the-loop承認要求、理由必須

### 拡張
- **AuditLog**: traceIdフィールド追加、ワークフロー系アクション追加
- **NodeSchema**: taskId, llm-task/human-reviewタイプ追加

## 6. APIエンドポイント

### 既存（FlowOps Core）
- `POST/GET /api/issues` - Issue管理
- `POST /api/issues/:id/proposals/generate` - LLM提案生成
- `POST /api/proposals/:id/apply` - パッチ適用
- `GET /api/flows` - フロー一覧

### 新規（ワークフロー）
- `POST /api/workflows` - ワークフロー実行開始
- `GET /api/workflows` - 実行一覧
- `GET /api/workflows/:id` - 実行状態
- `POST /api/workflows/:id/approve` - 承認/否認
- `POST /api/workflows/:id/cancel` - キャンセル

### 新規（タスク）
- `GET /api/tasks` - タスク一覧
- `GET /api/tasks/:id` - タスク詳細
- `POST /api/tasks/:id/test` - ドライラン

### 新規（ガバナンス）
- `GET /api/governance/trace/:traceId` - E2Eトレース検索

## 7. インフラ構成（Docker Compose）

```yaml
services:
  flowops:     # Layer 1+2: Next.js App
  litellm:     # Layer 3: LLM Gateway
  ollama:      # Layer 4: Local LLM (optional)
  langfuse:    # Layer 5: Governance
  postgres:    # FlowOps DB
  langfuse-db: # Langfuse DB
```

## 8. 段階的移行

| Phase | 内容 | 独立価値 |
|-------|------|---------|
| Phase 0 | PostgreSQL + Trace ID基盤 | 既存システム強化 |
| Phase 1 | LiteLLM + Langfuse | LLM一元管理・可視化 |
| Phase 2 | マイクロタスクシステム | タスク定義の形式化 |
| Phase 3 | ワークフローエンジン | 業務フロー自動実行 |
| Phase 4 | ガバナンスAPI | ISO 42001トレーサビリティ |
| Phase 5 | 本番インフラ | 本番デプロイ準備 |

## 9. ディレクトリ構造

```
src/core/orchestrator/     ← 統合の心臓部
  ├── schemas/
  │   ├── micro-task.ts    ← マイクロタスクZodスキーマ
  │   └── execution.ts     ← 実行状態スキーマ
  ├── compiler.ts          ← YAMLフロー→ステートマシン
  ├── engine.ts            ← 実行エンジン
  ├── task-loader.ts       ← タスク読込
  ├── task-registry.ts     ← タスクレジストリ
  ├── task-executor.ts     ← タスク実行
  ├── human-loop.ts        ← Human-in-the-loop
  └── index.ts

src/lib/trace-context.ts   ← Trace ID伝播（AsyncLocalStorage）
spec/tasks/                ← マイクロタスク定義YAML
infrastructure/litellm/    ← LiteLLM設定
```
