# FlowOps - GitOps for Business

業務フロー（Business Logic）を「コード（YAML）」として正本管理しつつ、非エンジニアでも理解・指摘・修正提案ができる「GitOps for Business」プラットフォーム。

## コア・コンセプト

| 原則 | 説明 |
|------|------|
| **SSOT (Single Source of Truth)** | 全ての業務フローは `spec/flows/*.yaml` を正本とする。DBはIssue管理用の派生データ |
| **GitOps Automation** | UI操作をGitコマンド（branch, commit, merge）に自動変換。履歴の透明性と復元性を担保 |
| **LLM-Assisted Proposals** | Issue報告に基づきLLMがYAML修正案（JSON Patch）を自動生成。Zodスキーマで出力を検証 |
| **Robust Issue Management** | 「同じ指摘」が複数来ることを前提に、重複統合（Merge Duplicates）をシステムレベルでサポート |

## アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│  UI Layer (Next.js App Router + React)          │
│  Dashboard / Flow Viewer / Issue Management     │
└─────────────────────┬───────────────────────────┘
                      │  REST API
┌─────────────────────▼───────────────────────────┐
│  Core Logic Layer                               │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐      │
│  │ Parser   │ │ Git Mgr  │ │ LLM Client │      │
│  │ (Zod)    │ │ (Mutex)  │ │ (Multi)    │      │
│  └──────────┘ └──────────┘ └────────────┘      │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐      │
│  │ Patch    │ │ Issue    │ │ Audit Log  │      │
│  │ (RFC6902)│ │ Lifecycle│ │            │      │
│  └──────────┘ └──────────┘ └────────────┘      │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│  Persistence Layer                              │
│  SQLite (Prisma ORM)  +  Local Git Repository   │
│  Issues/Proposals/Audit   YAML Files (The Truth)│
└─────────────────────────────────────────────────┘
```

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| Runtime | Node.js LTS |
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (Strict Mode) |
| Database | PostgreSQL + Prisma ORM |
| UI | Tailwind CSS + shadcn/ui + Lucide React |
| Flow Visualization | Mermaid.js |
| Git | simple-git (Mutex Lock付き) |
| LLM | OpenAI互換API（マルチプロバイダー対応） |
| Validation | Zod (全入出力境界で使用) |
| Testing | Vitest |

## 最速ローカル起動

**前提条件**: Node.js >= 18, Git, Docker

```bash
# 1. DB起動
docker compose up postgres -d

# 2. セットアップ
npm install
cp .env.example .env.local  # LLM_API_KEY を編集
npx prisma db push
npm run db:seed

# 3. 起動
npm run dev
# → http://localhost:3000
```

> `.env.example` の先頭にある「ローカル最小構成」セクションの3項目（`DATABASE_URL`, `AUTH_SECRET`, `LLM_API_KEY`）を設定するだけで動きます。

## Docker起動（フルスタック）

LiteLLM（LLMゲートウェイ）+ Langfuse（LLMOps）を含む完全構成:

```bash
cp .env.example .env
# .env で OPENAI_API_KEY 等を設定

docker compose up -d
# → FlowOps:  http://localhost:3000
# → Langfuse:  http://localhost:3001
# → LiteLLM:   http://localhost:4000
```

### 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `DATABASE_URL` | Yes | SQLiteパス（デフォルト: `file:./dev.db`） |
| `LLM_PROVIDER` | No | プロバイダー名（デフォルト: `openai`） |
| `LLM_API_KEY` | Yes | APIキー（全プロバイダー共通） |
| `LLM_MODEL` | No | モデル名（省略時はプロバイダーのデフォルト） |
| `LLM_BASE_URL` | No | カスタムベースURL（プロバイダーデフォルトを上書き） |
| `LLM_JSON_MODE` | No | JSON modeサポート（`true`/`false`, プロバイダー依存） |
| `OPENAI_API_KEY` | - | 後方互換（`LLM_API_KEY`未設定時のフォールバック） |
| `OPENAI_MODEL` | - | 後方互換（`LLM_MODEL`未設定時のフォールバック） |

### スクリプト

```bash
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
npm run test         # テスト実行 (Vitest)
npm run test:watch   # テスト監視モード
npm run test:coverage # カバレッジ付きテスト
npm run typecheck    # TypeScript型チェック
npm run lint         # ESLint
npm run format       # Prettier整形
npm run db:push      # Prismaスキーマ同期
npm run db:studio    # Prisma Studio (DB GUI)
```

## GitOps ワークフロー

FlowOpsの中心となる操作サイクル:

```
1. Issue作成          POST /api/issues
      │
2. 作業開始           POST /api/issues/:id/start
      │                 → cr/ISS-001-fix-typo ブランチ作成
3. LLM提案生成        POST /api/issues/:id/proposals/generate
      │                 → JSON Patch + Diff Preview 生成
4. パッチ適用         POST /api/proposals/:id/apply
      │                 → YAML更新 → git commit（成功後にDB更新）
5. マージ＆クローズ   POST /api/issues/:id/merge-close
                        → main へマージ → Issue closed
```

**鉄則**: DB状態の更新は、Git commitが成功した後にのみ実行される。

## データモデル

```
Issue (ISS-001形式)
├── status: new → triage → in-progress → proposed → merged / rejected
├── targetFlowId: 対象YAMLフロー
├── branchName: Git作業ブランチ
├── canonicalId: 重複統合先（Duplicateチェーン）
├── proposals[]: LLM生成パッチ（baseHash付き陳腐化検知）
└── evidences[]: スクリーンショット/リンク/ログ

Proposal
├── intent: 変更意図の要約
├── jsonPatch: RFC 6902 JSON Patch
├── diffPreview: HTML差分表示
└── baseHash: 生成時点のYAMLハッシュ（Stale検知用）

AuditLog
├── actor / action / entityType / entityId / payload
└── 全操作の "誰が/いつ/何を/なぜ" を追跡
```

## YAML フロー定義

`spec/flows/*.yaml` が業務フローのSSOT。`nodes`と`edges`はRecord構造（配列ではない）で、JSON Patchの安定性を確保。

```yaml
id: order-process
title: 受注処理フロー
layer: L1                    # L0=戦略, L1=業務プロセス, L2=システム手順
updatedAt: "2026-02-05T00:00:00Z"

nodes:
  start_node:
    id: start_node
    type: start              # start / end / process / decision / database
    label: 受注開始
  receive_order:
    id: receive_order
    type: process
    label: 受注受付
    role: 営業               # spec/dictionary/roles.yaml で定義
    system: CRM              # spec/dictionary/systems.yaml で定義

edges:
  e1:
    id: e1
    from: start_node
    to: receive_order
```

**バリデーション (Zod + 参照整合性)**:
- Zodスキーマによる構造・型検証
- `edges[*].from/to` が nodes に存在するか
- start/end ノードの存在確認
- 孤立ノード・到達不能パスの警告

## API エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/flows` | フロー一覧 |
| GET | `/api/flows/:id` | フロー詳細 + Mermaid図 |
| GET/POST | `/api/issues` | Issue一覧 / 作成 |
| GET/PATCH/DELETE | `/api/issues/:id` | Issue詳細 / 更新 / 削除 |
| POST | `/api/issues/:id/start` | 作業開始（ブランチ作成） |
| POST | `/api/issues/:id/proposals/generate` | LLM提案生成 |
| POST | `/api/proposals/:id/apply` | パッチ適用 |
| POST | `/api/issues/:id/merge-close` | マージ＆クローズ |
| POST | `/api/issues/:id/merge-duplicate` | 重複統合 |
| GET | `/api/audit` | 監査ログ照会 |
| GET | `/api/health` | ヘルスチェック |

全レスポンスは `{ ok: boolean, data?, errorCode?, details? }` の統一形式。

## ディレクトリ構造

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # 全APIルート
│   ├── flows/                    # フロー閲覧ページ
│   ├── issues/                   # Issue管理ページ
│   ├── error.tsx                 # グローバルError Boundary
│   └── page.tsx                  # ダッシュボード
├── components/
│   ├── flow/                     # FlowViewer, MermaidViewer
│   ├── issue/                    # IssueList, IssueDetail, ProposalCard
│   └── ui/                       # MainLayout, Toast, StatusBadge, Spinner
├── core/                         # フレームワーク非依存のビジネスロジック
│   ├── git/manager.ts            # SimpleGitラッパー（Mutex Lock付き）
│   ├── git/lock.ts               # Repo排他制御（タイムアウト30s, 自動解除60s）
│   ├── parser/schema.ts          # Zod: Flow/Node/Edge/Layer型定義
│   ├── parser/validateFlow.ts    # 参照整合性チェック
│   ├── parser/toMermaid.ts       # Flow → Mermaid変換
│   ├── patch/apply.ts            # RFC 6902 JSON Patch適用
│   ├── patch/diff.ts             # Flow差分計算 + HTML出力
│   ├── patch/hash.ts             # SHA256 (baseHash, 陳腐化検知)
│   ├── llm/client.ts             # マルチプロバイダーLLMクライアント（リトライ, 出力検証）
│   ├── llm/prompts.ts            # プロンプトテンプレート + 禁止事項
│   ├── issue/humanId.ts          # ISS-001形式ID生成
│   ├── issue/duplicate.ts        # 重複統合ロジック（状態遷移検証）
│   ├── audit/logger.ts           # 監査ログ記録
│   └── types/api.ts              # API統一レスポンス型
└── lib/
    ├── prisma.ts                 # Prismaクライアント
    ├── flow-service.ts           # YAML I/O + 辞書読み込み
    ├── api-utils.ts              # レスポンスヘルパー + sanitizeFlowId
    ├── audit-repository.ts       # 監査ログPrismaリポジトリ
    └── bootstrap.ts              # アプリ初期化

spec/
├── flows/                        # YAML正本 (SSOT)
│   ├── order-process.yaml        # 受注処理フロー (L1)
│   ├── inquiry-handling.yaml     # 問い合わせ対応フロー (L1)
│   └── shipping-process.yaml     # 出荷処理フロー (L1)
└── dictionary/
    ├── roles.yaml                # 役割定義 (営業, 倉庫, 購買, etc.)
    └── systems.yaml              # システム定義 (CRM, WMS, ERP, etc.)

prisma/
├── schema.prisma                 # Issue, Proposal, Evidence, AuditLog
└── dev.db                        # SQLiteデータベース
```

## セキュリティ

- **パストラバーサル対策**: flowIdは英数字・ハイフン・アンダースコアのみ許可
- **LLM入力制限**: spec/flows と spec/dict の内容のみLLMに渡す。`.env`やパス情報は渡さない
- **LLM出力検証**: Zodスキーマ + 禁止パス検出(`/id`変更不可) + role/system辞書チェック
- **Git排他制御**: Repo操作はMutex Lockで保護。タイムアウト付き自動解除
- **DB整合性ルール**: Git commit成功後にのみDB状態を変更（不整合防止）

## テスト

```bash
npm run test           # 全テスト実行
npm run test:coverage  # カバレッジレポート
```

| テスト対象 | 内容 |
|-----------|------|
| `core/parser` | Zodスキーマ検証（有効/無効フロー, レイヤー） |
| `core/patch/apply` | JSON Patch適用, stale hash検出, 禁止パス |
| `core/patch/hash` | SHA256一貫性, hashMatch比較 |
| `core/issue/humanId` | ISS-001形式生成, ブランチ名, スラグ |
| `core/issue/duplicate` | 重複統合の状態遷移検証 |
| `core/git/lock` | Mutex取得/解放, タイムアウト |
| `lib/flow-service` | sanitizeFlowId（パストラバーサル拒否） |

## LLM プロバイダー設定

OpenAI互換APIを使用し、複数のLLMプロバイダーに対応。`LLM_PROVIDER`環境変数で切り替え可能。

### 対応プロバイダー一覧

| プロバイダー | `LLM_PROVIDER` | デフォルトモデル | JSON Mode | ベースURL |
|-------------|----------------|-----------------|-----------|-----------|
| OpenAI | `openai` | `gpt-4o` | Yes | `https://api.openai.com/v1` |
| Anthropic | `anthropic` | `claude-sonnet-4-5-20250929` | No | `https://api.anthropic.com/v1` |
| Google Gemini | `gemini` | `gemini-2.0-flash` | Yes | `https://generativelanguage.googleapis.com/v1beta/openai` |
| Groq | `groq` | `llama-3.3-70b-versatile` | Yes | `https://api.groq.com/openai/v1` |
| Ollama (ローカル) | `ollama` | `llama3.2` | Yes | `http://localhost:11434/v1` |
| カスタム | `custom` | - | 要設定 | `LLM_BASE_URL`で指定 |

### プロバイダー別 .env.local 設定例

#### OpenAI

```bash
LLM_PROVIDER=openai
LLM_API_KEY=sk-xxxxxxxxxxxxxxxx
# LLM_MODEL=gpt-4o  (デフォルト)
```

#### Anthropic (Claude)

```bash
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
# LLM_MODEL=claude-sonnet-4-5-20250929  (デフォルト)
# JSON mode非対応のため、レスポンスからJSON部分を自動抽出
```

#### Google Gemini

```bash
LLM_PROVIDER=gemini
LLM_API_KEY=AIzaxxxxxxxxxxxxxxxxx
# LLM_MODEL=gemini-2.0-flash  (デフォルト)
```

#### Groq

```bash
LLM_PROVIDER=groq
LLM_API_KEY=gsk_xxxxxxxxxxxxxxxx
# LLM_MODEL=llama-3.3-70b-versatile  (デフォルト)
```

#### Ollama (ローカルLLM)

```bash
LLM_PROVIDER=ollama
LLM_API_KEY=ollama  # Ollamaではダミー値でOK
# LLM_MODEL=llama3.2  (デフォルト)
```

#### カスタムOpenAI互換サーバー

```bash
LLM_PROVIDER=custom
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://your-server.example.com/v1
LLM_MODEL=your-model-name
LLM_JSON_MODE=true
```

### JSON Mode非対応プロバイダーの扱い

JSON Modeをサポートしないプロバイダー（Anthropic等）の場合、LLMの応答から以下の順序でJSONを自動抽出します:

1. レスポンス全体をそのまま `JSON.parse()`
2. ` ```json ... ``` ` コードブロックから抽出
3. 最初の `{ ... }` ブロックを抽出

これにより、プロバイダーを問わず安定した動作を実現しています。

## エージェント/スキル

`.claude/skills/` と `.claude/agents/` にAIエージェント用のスキル定義:

| スキル | 説明 |
|--------|------|
| `git-ops` | Git操作の自動化とリポジトリ管理 |
| `issue-management` | Issue/Proposal/Evidenceのライフサイクル管理 |
| `llm-patch` | LLMを活用したパッチ生成と適用 |
| `yaml-flow` | YAMLフロー定義の解析・検証・変換 |
| `audit-log` | 監査ログの記録・照会 |

## ドキュメント

| ファイル | 内容 |
|----------|------|
| `docs/start.md` | システム要件定義書 v1.0 |
| `docs/start.add.md` | レビュー追補提案（非機能要件, セキュリティ, 監査等） |
| `CLAUDE.md` | AI Agent用のプロジェクトコンテキスト |

## License

MIT
