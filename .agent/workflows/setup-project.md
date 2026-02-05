---
description: FlowOps プロジェクトの初期セットアップ手順
---

# FlowOps プロジェクト初期セットアップ

## 前提条件

- Node.js LTS がインストールされていること
- Git がインストールされていること

## セットアップ手順

// turbo-all

### 1. Next.js プロジェクト作成

```bash
npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

### 2. 依存パッケージのインストール

```bash
npm install prisma @prisma/client simple-git openai zod yaml react-mermaid2 lucide-react
```

### 3. shadcn/ui の初期化

```bash
npx -y shadcn@latest init
```

### 4. 必要な shadcn コンポーネントの追加

```bash
npx -y shadcn@latest add dialog sheet table badge tabs button card input textarea
```

### 5. Prisma の初期化

```bash
npx prisma init --datasource-provider sqlite
```

### 6. ディレクトリ構造の作成

```bash
mkdir -p src/core/git src/core/parser src/core/patch src/core/llm src/core/issue src/core/audit
mkdir -p src/components/flow src/components/issue src/components/ui
mkdir -p spec/flows spec/dict
mkdir -p prisma
```

### 7. Git リポジトリの初期化

```bash
git init
```

### 8. 環境変数ファイルの作成

`.env.local` を作成し、以下を追加:

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
DATABASE_URL="file:./dev.db"
```

## 次のステップ

1. `prisma/schema.prisma` を設計書に基づいて編集
2. `npx prisma db push` でスキーマを適用
3. 基本コンポーネントの実装を開始
