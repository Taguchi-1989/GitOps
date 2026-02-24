
# FlowOps MVP システム要件定義書 v1.0

**Project Name:** FlowOps
**Version:** 1.0.0 (Master Reference)
**Status:** Definitive for Implementation

## 1. プロジェクト概要

### 1.1 目的

業務フロー（Business Logic）を「コード（YAML）」として正本管理しつつ、非エンジニアでも理解・指摘・修正提案ができる「GitOps for Business」プラットフォームを構築する。

### 1.2 コア・コンセプト

1. **Single Source of Truth (SSOT):** 全ての業務フローは `spec/flows/*.yaml` を正本とする。DBはあくまでIssue管理と検索インデックス用であり、フローそのもののマスタではない。
2. **GitOps Automation:** ユーザーのUI操作（修正提案、承認）を、バックグラウンドでGitコマンド（branch, commit, merge）に変換し、履歴の透明性と復元性を担保する。
3. **Robust Issue Management:** 「同じような指摘」が複数来ることを前提とし、システムレベルで「重複統合（Merge Duplicates）」をサポートする。

---

## 2. システムアーキテクチャ

### 2.1 全体構成図

アプリケーションは「UI層」「コアロジック層」「データ永続化層」の3層で構成される。

```mermaid
graph TD
    User[User (MVP: You)] --> UI[Next.js App Router]
    
    subgraph "Application Layer"
        UI --> API[API Routes]
        API --> Parser[YAML Parser/Validator (Zod)]
        API --> GitMgr[Git Manager (simple-git)]
        API --> LLM[LLM Agent (OpenAI)]
    end
    
    subgraph "Persistence Layer"
        GitMgr --> LocalRepo[Local Git Repository]
        LocalRepo --> YAML[YAML Files (The Truth)]
        
        API --> Prisma[Prisma ORM]
        Prisma --> SQLite[SQLite DB (Issues/Proposals)]
    end

```

### 2.2 技術スタック選定（固定）

* **Runtime:** Node.js (LTS)
* **Framework:** Next.js 14+ (App Router)
* **Language:** TypeScript (Strict Mode)
* **Database:** SQLite (`dev.db`) ※将来のPostgreSQL移行を見据えPrismaを使用
* **Styling:** Tailwind CSS + shadcn/ui
* **Icons:** Lucide React
* **Visualization:** `react-mermaid2` (Interactive Mermaid Rendering)
* **Git Integration:** `simple-git`
* **LLM Integration:** OpenAI API (`gpt-4o`)

---

## 3. データモデル詳細設計

### 3.1 データベース（SQLite/Prisma）

Issue管理、提案状態、エビデンス管理を行うためのスキーマ。

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// --------------------------------------------------------
// Issue Management
// --------------------------------------------------------
model Issue {
  id             String    @id @default(cuid())
  humanId        String    @unique // 表示用ID (例: ISS-001)
  title          String
  description    String
  
  // Status Management
  // values: 'new', 'triage', 'in-progress', 'proposed', 'merged', 'rejected', 'merged-duplicate'
  status         String    @default("new")
  
  // Target Identification (YAMLとの紐付け)
  targetFlowId   String?   // 対象ファイル名 (例: order-process.yaml)
  targetNodeId   String?   // 対象ノードID (例: node_123)
  
  // Duplicate Handling logic (重複統合ロジック)
  canonicalId    String?   // 統合先の親Issue ID
  canonicalIssue Issue?    @relation("Duplicates", fields: [canonicalId], references: [id])
  duplicates     Issue[]   @relation("Duplicates")

  // Git Operations
  branchName     String?   // 作業用ブランチ (例: cr/ISS-001-fix-typo)
  
  // Relationships
  proposals      Proposal[]
  evidences      Evidence[]
  
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

// --------------------------------------------------------
// Change Proposals (LLM or Manual)
// --------------------------------------------------------
model Proposal {
  id             String   @id @default(cuid())
  issueId        String
  issue          Issue    @relation(fields: [issueId], references: [id])
  
  intent         String   // 変更意図の要約
  jsonPatch      String   // JSON Patch形式の差分データ
  diffPreview    String?  // 表示用のDiff（テキストまたはHTML）
  
  isApplied      Boolean  @default(false) // 適用済みフラグ
  appliedAt      DateTime?
  
  createdAt      DateTime @default(now())
}

// --------------------------------------------------------
// Evidences
// --------------------------------------------------------
model Evidence {
  id        String @id @default(cuid())
  issueId   String
  issue     Issue  @relation(fields: [issueId], references: [id])
  
  type      String // 'screenshot', 'link', 'text_log'
  url       String // ファイルパスまたはURL
  note      String?
}

```

### 3.2 YAML構造（Flow Definition）

Zodスキーマによる厳密な型定義。配列インデックスへの依存を排除し、ID参照を強制する。

**ファイルパス:** `spec/flows/*.yaml`

```typescript
// core/types/flow.ts (Zod定義の概念コード)

type FlowID = string;
type NodeID = string;

// ノード定義：IDをキーとするRecord型で管理
interface Node {
  id: NodeID;
  type: 'start' | 'end' | 'process' | 'decision' | 'database';
  label: string;
  role?: string;   // roles.yamlのキーと一致すること
  system?: string; // systems.yamlのキーと一致すること
  meta?: Record<string, any>;
}

// エッジ定義：From/Toによる接続
interface Edge {
  id: string;
  from: NodeID;
  to: NodeID;
  label?: string;
  condition?: string; // 分岐条件
}

// フロー全体定義
interface Flow {
  id: FlowID;
  title: string;
  layer: 'L0' | 'L1' | 'L2';
  updatedAt: string;
  nodes: Record<NodeID, Node>; // 【重要】配列ではなくMap
  edges: Edge[];
}

```

---

## 4. 機能要件とロジック詳細

### 4.1 Issue管理と重複統合（Duplicate Merge）

**要件:** 同種の指摘が複数上がった場合、一つを「正（Canonical）」とし、他をそれに紐づけてクローズする。

**ロジック:**

1. **統合アクション:** ユーザーが Issue B を開き、「Issue A に統合」を選択。
2. **DB更新:**
* `IssueB.canonicalId = IssueA.id`
* `IssueB.status = 'merged-duplicate'`


3. **UI表示:**
* Issue B の画面: 「このIssueは Issue A に統合されました」とリンクを表示し、編集ロック。
* Issue A の画面: 「関連するIssue: Issue B」と表示し、Issue Bのエビデンスも参照可能にする。


4. **Git処理:** Issue B 用に作成されていたブランチがあれば削除する（変更作業は Issue A のブランチに集約するため）。

### 4.2 GitOps サイクル（自動化フロー）

MVP（1人運用）におけるGit操作の自動化ルール。

| フェーズ | トリガー | システム動作 (Backend) |
| --- | --- | --- |
| **1. 着手** | Issue詳細で「変更作業を開始」ボタン押下 | `git checkout -b cr/{ISSUE_ID}-{slug}` |
| **2. 提案** | 「LLM提案生成」ボタン押下 | 1. YAMLと辞書を読み込む<br>

<br>2. OpenAIに投げる<br>

<br>3. `Proposal` レコードを作成（JSON Patch保存） |
| **3. 適用** | 提案確認画面で「適用（Apply）」押下 | 1. YAMLにJSON Patchを適用<br>

<br>2. Zodバリデーション実行<br>

<br>3. ファイル保存<br>

<br>4. `git add .`<br>

<br>5. `git commit -m "feat: apply proposal for {ISSUE_ID}"` |
| **4. 完了** | 「完了（Merge & Close）」ボタン押下 | 1. `git checkout main`<br>

<br>2. `git merge cr/{ISSUE_ID}...`<br>

<br>3. `git branch -d cr/{ISSUE_ID}...`<br>

<br>4. `Issue.status = 'merged'` |

### 4.3 フロー閲覧とインタラクション

**要件:** Mermaid.js で図を描画し、ノードクリックでインタラクションを行う。

* **レンダリング:** サーバーサイドで YAML を解析し、Mermaid 記法（graph TDなど）のテキストに変換してクライアントへ送る。
* **クリックイベント:**
* Mermaid の `click nodeID callback` 構文を使用。
* クリックされた `nodeID` をフックし、サイドパネルに詳細属性（role, system, description）を表示する。
* サイドパネルから「このノードについてIssueを作成」ボタンを表示する。



---

## 5. UI/UX コンポーネント要件

### 5.1 画面一覧

1. **Flow Viewer (`/flows/[id]`)**
* 左ペイン: Mermaid 図面（Zoom/Pan対応）
* 右ペイン: 属性インスペクタ 兼 コンテキストメニュー


2. **Issue Dashboard (`/issues`)**
* Inbox形式のリスト（ステータス別タブ: Open / Proposed / Closed）
* フィルタ: `status`, `targetFlow`


3. **Issue Detail / Workspace (`/issues/[id]`)**
* チャット形式のIssue履歴（コメント、エビデンス表示）
* 提案（Proposal）のプレビュー（Before/After Diff表示）
* アクションボタン群（Generate Proposal, Apply Patch, Merge & Close）



### 5.2 必須コンポーネント (shadcn/ui base)

* `Dialog`: Issue作成モーダル
* `Sheet`: ノード詳細サイドパネル
* `Table`: Issue一覧
* `Badge`: ステータス表示（Color-coded）
* `Tabs`: フローレイヤー切り替え（L0/L1/L2）
* `DiffViewer`: テキスト差分の可視化（独自実装 or ライブラリ）

---

## 6. ディレクトリ構造（開発時の厳守事項）

```text
/
├── app/
│   ├── api/
│   │   ├── git/route.ts      # Git操作エンドポイント
│   │   ├── issues/route.ts   # Issue CRUD
│   │   └── llm/route.ts      # LLM Patch生成
│   ├── flows/[id]/page.tsx   # ビューワー
│   └── issues/[id]/page.tsx  # Issue詳細・作業場
├── components/
│   ├── flow/                 # Mermaid関連
│   ├── issue/                # Issue関連
│   └── ui/                   # shadcn基本パーツ
├── core/                     # ビジネスロジック（フレームワーク非依存）
│   ├── git/                  # SimpleGit Wrapper
│   ├── parser/               # YAML Parser & Zod Schemas
│   ├── patch/                # JSON Patch Logic
│   └── llm/                  # Prompts & OpenAI Client
├── lib/                      # Utils (DB Client etc)
├── prisma/
│   └── schema.prisma         # DB Schema
└── spec/                     # [USER DATA]
    ├── flows/                # YAML Files
    └── dict/                 # Dictionaries

```

---

## 7. 将来の拡張性への備え（Roadmap Consideration）

このv1.0設計は、以下の将来要件変更に対し、**コードの書き直し不要（設定変更のみ）**で対応できるよう設計されている。

1. **DB移行 (SQLite -> PostgreSQL):**
* Prismaを使用しているため、`datasource` の設定変更のみで完了する。


2. **認証 (Local -> Entra ID):**
* Issueテーブルの `reporter` フィールド（現在は省略/固定）を拡張し、NextAuth.jsを入れるだけで対応可能。


3. **複数人同時編集:**
* Gitブランチ運用を基本にしているため、コンフリクト発生時もGitの標準機能（Merge Conflict）として処理可能。

