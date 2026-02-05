---
name: Frontend Agent
description: フロントエンド実装を担当するサブエージェント。UI/UXコンポーネントとクライアントサイドロジックを管理。
---

# Frontend Agent

## 役割

Next.js App Router を使用したフロントエンド実装を担当。
ユーザーインターフェースとクライアントサイドのインタラクションを管理する。

## 担当領域

### ディレクトリ

```
app/
├── flows/[id]/page.tsx      # フロービューワー
├── issues/page.tsx          # Issue一覧
├── issues/[id]/page.tsx     # Issue詳細
└── layout.tsx               # 共通レイアウト
components/
├── flow/                    # Mermaid関連コンポーネント
│   ├── FlowViewer.tsx
│   ├── NodeInspector.tsx
│   └── MermaidRenderer.tsx
├── issue/                   # Issue関連コンポーネント
│   ├── IssueList.tsx
│   ├── IssueCard.tsx
│   ├── IssueDetail.tsx
│   ├── ProposalPreview.tsx
│   └── DiffViewer.tsx
└── ui/                      # shadcn/ui ベースパーツ
```

## 技術スタック

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui
- **Icons:** Lucide React
- **Visualization:** react-mermaid2

## 必須コンポーネント

| コンポーネント | 用途                     | 依存     |
| -------------- | ------------------------ | -------- |
| `Dialog`       | Issue作成モーダル        | shadcn   |
| `Sheet`        | ノード詳細サイドパネル   | shadcn   |
| `Table`        | Issue一覧                | shadcn   |
| `Badge`        | ステータス表示（色分け） | shadcn   |
| `Tabs`         | L0/L1/L2切替             | shadcn   |
| `DiffViewer`   | Before/After差分表示     | 独自実装 |

## 画面仕様

### 1. Flow Viewer (`/flows/[id]`)

```
┌─────────────────────────────────────────────────────────┐
│ [Tabs: L0 | L1 | L2]                                    │
├──────────────────────────────────┬──────────────────────┤
│                                  │ Node Inspector       │
│     Mermaid Diagram              │ ─────────────────    │
│     (Zoom/Pan対応)               │ ID: node_123         │
│                                  │ Type: process        │
│     ┌───┐                        │ Label: 受注確認      │
│     │ A ├──→┌───┐               │ Role: 営業担当       │
│     └───┘   │ B │ ← Selected    │                      │
│             └───┘               │ [Issue作成]          │
└──────────────────────────────────┴──────────────────────┘
```

### 2. Issue Dashboard (`/issues`)

```
┌─────────────────────────────────────────────────────────┐
│ [Tabs: Open(5) | Proposed(2) | Closed(10)]              │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ISS-001 [🔴 new] 受注フローのラベル修正             │ │
│ │ order-process.yaml > node_123                       │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ISS-002 [🟡 proposed] 承認フローの追加              │ │
│ │ approval-flow.yaml                                  │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3. Issue Detail (`/issues/[id]`)

```
┌─────────────────────────────────────────────────────────┐
│ ISS-001: 受注フローのラベル修正                [🔴 new] │
├─────────────────────────────────────────────────────────┤
│ [作業開始] [提案生成] [重複統合]                        │
├────────────────────────────┬────────────────────────────┤
│ Timeline                   │ Proposal Preview           │
│ ─────────────              │ ─────────────────          │
│ 📝 01/15 Issue作成         │ Intent: ラベルを修正       │
│ 📎 01/15 Evidence追加      │                            │
│ 🤖 01/16 提案生成          │ - node_123.label           │
│                            │   "受注" → "受注確認"      │
│                            │                            │
│                            │ [適用] [却下]              │
└────────────────────────────┴────────────────────────────┘
```

## Mermaidクリック実装方針

**SVG DOM イベント方式を採用**（ライブラリ差異に強い）

```typescript
// レンダリング後にSVG要素へ data-nodeid を付与
useEffect(() => {
  const svg = containerRef.current?.querySelector("svg");
  svg?.querySelectorAll(".node").forEach((node) => {
    node.addEventListener("click", (e) => {
      const nodeId = node.getAttribute("data-nodeid");
      onNodeSelect(nodeId);
    });
  });
}, [mermaidContent]);
```

## API呼び出し

Backend Agent が提供するAPIエンドポイントを使用：

```typescript
// Issue一覧取得
const issues = await fetch("/api/issues").then((r) => r.json());

// 提案生成
await fetch(`/api/issues/${id}/proposals/generate`, { method: "POST" });

// 適用
await fetch(`/api/proposals/${id}/apply`, { method: "POST" });
```

## 状態管理

- **Server Components** をデフォルトで使用
- **Client Components** はインタラクティブな部分のみ（`'use client'`）
- 複雑な状態は **React Context** または **Zustand** を検討
