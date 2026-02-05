# FlowOps - GitOps for Business

業務フロー（Business Logic）を「コード（YAML）」として正本管理しつつ、非エンジニアでも理解・指摘・修正提案ができる「GitOps for Business」プラットフォーム。

## 🎯 コア・コンセプト

1. **Single Source of Truth (SSOT):** 全ての業務フローは `spec/flows/*.yaml` を正本とする
2. **GitOps Automation:** UI操作をGitコマンド（branch, commit, merge）に自動変換
3. **Robust Issue Management:** 重複統合（Merge Duplicates）をシステムレベルでサポート

## 🚀 クイックスタート

### 前提条件

- Node.js LTS
- Git

### セットアップ

```bash
# 依存パッケージのインストール
npm install

# 環境変数の設定
cp .env.example .env.local
# .env.local を編集してOPENAI_API_KEYを設定

# データベースの初期化
npx prisma db push

# 開発サーバー起動
npm run dev
```

## 📁 ディレクトリ構造

```
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   ├── flows/[id]/           # フロービューワー
│   └── issues/[id]/          # Issue詳細
├── components/               # Reactコンポーネント
│   ├── flow/                 # Mermaid関連
│   ├── issue/                # Issue関連
│   └── ui/                   # shadcn/ui
├── core/                     # ビジネスロジック
│   ├── git/                  # Git操作
│   ├── parser/               # YAML解析
│   ├── patch/                # JSON Patch
│   ├── llm/                  # LLM統合
│   ├── issue/                # Issue管理
│   └── audit/                # 監査ログ
├── lib/                      # ユーティリティ
├── prisma/                   # DBスキーマ
└── spec/                     # YAML正本データ
    ├── flows/                # フロー定義
    └── dict/                 # 辞書（roles, systems）
```

## 🔧 開発ガイド

### エージェント/スキル構成

- `.gemini/agents/` - Gemini用エージェント定義
- `.claude/agents/` - Claude用エージェント定義
- `.agent/workflows/` - 共通ワークフロー

### 利用可能なワークフロー

| コマンド           | 説明                         |
| ------------------ | ---------------------------- |
| `/setup-project`   | プロジェクト初期化           |
| `/gitops-cycle`    | Issue着手→マージ完了サイクル |
| `/duplicate-merge` | Issue重複統合                |

## 📖 ドキュメント

- `start.md` - システム要件定義書
- `start.add.md` - 追補提案

## 📝 License

MIT
