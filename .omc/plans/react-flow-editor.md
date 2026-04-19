# React Flow エディター導入計画

**方針:** React Flow をメインビジュアルエディターとして導入。Mermaid はエクスポート専用（SVG出力）に残す。

**作成日:** 2026-04-19
**ステータス:** ユーザー確認待ち

---

## Context

### 現在のアーキテクチャ
- **ビューワー:** MermaidViewer.tsx（SVGレンダリング + DOM操作によるクリック検知）
- **データモデル:** Flow型（`Record<NodeID, Node>`, `Record<EdgeID, Edge>`）- Zodスキーマで検証
- **永続化:** YAML (spec/flows/*.yaml) → Git管理 → API経由で読み書き
- **変換パイプライン:** `parseFlowYaml()` -> Flow -> `flowToMermaid()` -> Mermaid文字列 -> mermaid.js SVG
- **編集手段:** LLMプロンプトコピー → 外部LLMでYAML生成 → インポート（FlowExportImport.tsx）
- **UI:** 3タブ構成（ダイアグラム / 生データ / エクスポート）in FlowViewer.tsx
- **ページ構成:** Server Component (page.tsx) -> Client Component (FlowViewerClient.tsx) -> FlowViewer

### 主要依存関係
- React 18.2, Next.js 14, TypeScript, Tailwind CSS 3.4, Zod 3.22
- mermaid 10.7（現在のダイアグラム表示）
- lucide-react（アイコン）
- UIライブラリなし

---

## 技術選定

### @xyflow/react (React Flow v12) を採用

**理由:**
1. **React 18ネイティブ対応** - hooks前提のAPI設計、SSR互換
2. **TypeScript first** - 型定義が充実、カスタムノード型の型安全性
3. **MIT License** - 商用利用制限なし（v11以降）
4. **既存データモデルとの親和性** - Flow型の nodes/edges Record構造から `Node[]`/`Edge[]` 配列への変換が直感的
5. **自動レイアウト** - dagre/elkjs との統合が容易（LLM生成フローの初期配置に必須）
6. **軽量** - バンドルサイズ約40KB gzip（Mermaid 約200KBと比較して小さい）

**不採用:**
- **JointJS** - 商用ライセンスが必要、React統合が二次的
- **GoJS** - 有料ライセンス
- **D3.js直接** - 低レベルすぎ、ノードエディター機能をゼロから実装する必要あり

### 追加パッケージ
- `@xyflow/react` - React Flow本体
- `dagre` + `@types/dagre` - 自動レイアウト（フローの初期配置計算）

---

## 主要インターフェース設計

### Flow <-> React Flow 変換の型定義

```typescript
// src/components/flow/editor/types.ts

import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import type { Flow, Node, Edge, NodeType } from '@/core/parser';

// --- カスタムノードデータ型 ---
export interface FlowNodeData {
  label: string;
  nodeType: NodeType;        // start | end | process | decision | ...
  role?: string;
  system?: string;
  taskId?: string;
  meta?: Record<string, unknown>;
  // 表示用（変換時に付与）
  isSelected?: boolean;
}

// React Flow用の型エイリアス
export type FlowNode = RFNode<FlowNodeData>;
export type FlowEdge = RFEdge<{ condition?: string }>;

// --- 変換関数のシグネチャ ---

/** Flow -> React Flow形式に変換（表示用） */
export function flowToReactFlow(flow: Flow): {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

/** React Flow形式 -> Flow に逆変換（保存用） */
export function reactFlowToFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  metadata: Pick<Flow, 'id' | 'title' | 'layer' | 'businessPurpose' | 'ownerOrg' | 'sensitivityLevel' | 'accessControl'>
): Flow;
```

### ノードタイプ別スタイルマップ

```typescript
// src/components/flow/editor/node-styles.ts

export const NODE_STYLE_MAP: Record<NodeType, {
  bgColor: string;       // Tailwind bg class
  borderColor: string;   // Tailwind border class
  textColor: string;     // Tailwind text class
  icon: string;          // lucide-react icon name
  shape: 'rounded' | 'diamond' | 'cylinder' | 'hexagon' | 'rectangle';
}> = {
  'start':        { bgColor: 'bg-emerald-500', borderColor: 'border-emerald-600', textColor: 'text-white', icon: 'Play',       shape: 'rounded'   },
  'end':          { bgColor: 'bg-red-500',     borderColor: 'border-red-600',     textColor: 'text-white', icon: 'Square',     shape: 'rounded'   },
  'process':      { bgColor: 'bg-blue-500',    borderColor: 'border-blue-600',    textColor: 'text-white', icon: 'Cog',        shape: 'rectangle' },
  'decision':     { bgColor: 'bg-amber-500',   borderColor: 'border-amber-600',   textColor: 'text-white', icon: 'GitBranch',  shape: 'diamond'   },
  'database':     { bgColor: 'bg-violet-500',  borderColor: 'border-violet-600',  textColor: 'text-white', icon: 'Database',   shape: 'cylinder'  },
  'llm-task':     { bgColor: 'bg-pink-500',    borderColor: 'border-pink-600',    textColor: 'text-white', icon: 'Sparkles',   shape: 'hexagon'   },
  'human-review': { bgColor: 'bg-teal-500',    borderColor: 'border-teal-600',    textColor: 'text-white', icon: 'UserCheck',  shape: 'rectangle' },
};
```

---

## Phase 1: React Flow 閲覧モード（Mermaid置き換え）

**目標:** 既存のMermaidダイアグラムタブをReact Flowに置き換え、同等以上の閲覧体験を提供する。編集機能はまだ入れない。

**スコープ:**
- Flow -> React Flow データ変換
- カスタムノードコンポーネント（7ノードタイプ対応）
- dagre自動レイアウト
- ノードクリック -> サイドパネル詳細表示（既存機能の移植）
- ズーム/パン/フィットビュー

### 新規作成ファイル

| ファイルパス | 役割 |
|---|---|
| `src/components/flow/editor/types.ts` | 型定義（FlowNode, FlowEdge, 変換関数シグネチャ） |
| `src/components/flow/editor/converters.ts` | `flowToReactFlow()` / `reactFlowToFlow()` 双方向変換 |
| `src/components/flow/editor/converters.test.ts` | 変換関数のユニットテスト |
| `src/components/flow/editor/node-styles.ts` | ノードタイプ別スタイル定義 |
| `src/components/flow/editor/FlowCanvas.tsx` | React Flow描画コンポーネント（メイン） |
| `src/components/flow/editor/CustomNode.tsx` | カスタムノードコンポーネント（全タイプ共通、タイプ別スタイル切替） |
| `src/components/flow/editor/layout.ts` | dagre自動レイアウト計算 |
| `src/components/flow/editor/index.ts` | barrel export |

### 変更ファイル

| ファイルパス | 変更内容 |
|---|---|
| `package.json` | `@xyflow/react`, `dagre`, `@types/dagre` 追加 |
| `src/components/flow/FlowViewer.tsx` | ダイアグラムタブで `FlowCanvas` を使用（MermaidViewer からの切替） |
| `src/app/flows/[id]/FlowViewerClient.tsx` | mermaidContent prop を削除、flow のみ渡す形に変更 |
| `src/app/flows/[id]/page.tsx` | mermaid変換の呼び出しを削除（エクスポートタブ用にのみ残す） |

### 受入条件
- [ ] 既存の全ノードタイプ（7種）がタイプ別の色・形状で表示される
- [ ] ノードクリックでサイドパネルに詳細が表示される（既存機能と同等）
- [ ] 自動レイアウトにより、ノードが重ならず視認性の高い配置になる
- [ ] ズーム・パン・フィットビューが動作する
- [ ] エクスポートタブでMermaid SVGダウンロードが引き続き動作する
- [ ] `converters.test.ts` で Flow <-> ReactFlow の往復変換テストがパスする

---

## Phase 2: ビジュアル編集機能

**目標:** React Flow上でノードの追加・削除・接続をインタラクティブに行い、変更をYAMLに反映して保存する。

**スコープ:**
- ノード追加（ツールバーからドラッグ or クリック追加）
- ノード削除（Delete キー or コンテキストメニュー）
- エッジ接続/切断（ハンドルドラッグ）
- ノードラベル編集（ダブルクリック → インライン編集）
- 変更 -> Flow変換 -> YAML保存 API呼び出し
- Undo/Redo（基本的な操作履歴）

### 新規作成ファイル

| ファイルパス | 役割 |
|---|---|
| `src/components/flow/editor/EditorToolbar.tsx` | ノード追加ボタン群（7タイプ）、保存・Undo/Redo |
| `src/components/flow/editor/useFlowEditor.ts` | 編集状態管理hooks（nodes/edges state, 変更検知, Undo/Redo stack） |
| `src/components/flow/editor/NodeEditPanel.tsx` | サイドパネルでのノードプロパティ編集（label, role, system, taskId） |
| `src/components/flow/editor/EdgeEditPanel.tsx` | エッジラベル・条件編集パネル |
| `src/components/flow/editor/useAutoSave.ts` | 自動保存 / 手動保存の切替hooks |

### 変更ファイル

| ファイルパス | 変更内容 |
|---|---|
| `src/components/flow/editor/FlowCanvas.tsx` | 編集モード対応（`editable` prop追加、ハンドル表示、ドラッグ&ドロップ） |
| `src/components/flow/editor/CustomNode.tsx` | 接続ハンドル追加、ダブルクリック編集対応 |
| `src/components/flow/FlowViewer.tsx` | 編集/閲覧モード切替ボタン追加 |
| `src/app/flows/[id]/FlowViewerClient.tsx` | 保存API呼び出しロジック追加 |
| `src/app/api/flows/[id]/route.ts` | PUT ハンドラーに React Flow 座標情報の保存対応（meta.position） |

### 受入条件
- [ ] ツールバーから全7タイプのノードを追加できる
- [ ] ノード選択 → Deleteキーで削除できる
- [ ] ノード間をドラッグでエッジ接続できる
- [ ] ノードラベルをダブルクリックでインライン編集できる
- [ ] 「保存」ボタンでYAMLに反映され、API経由でspec/flows/に保存される
- [ ] Undo/Redo が直近20操作で動作する
- [ ] 未保存変更がある場合、ページ離脱時に警告が出る
- [ ] Zodバリデーションエラー時にUI上にエラー表示される（start/endノード必須等）

---

## Phase 3: LLM連携 + テンプレート

**目標:** LLMによるフロー生成・編集をReact Flowエディター内で完結させる。外部LLMへのコピペを不要にする。

**スコープ:**
- チャットパネルでの自然言語 → フロー生成/編集
- 既存API（`/api/flows/draft`, `/api/flows/create`）との統合
- テンプレートギャラリー（よくあるフローパターンのプリセット）
- LLM生成結果のプレビュー → 適用/却下

### 新規作成ファイル

| ファイルパス | 役割 |
|---|---|
| `src/components/flow/editor/AIChatPanel.tsx` | サイドパネルのAIチャットUI（自然言語入力 → フロー生成/編集） |
| `src/components/flow/editor/useAIFlowGeneration.ts` | LLM API呼び出し + レスポンスのFlow変換hooks |
| `src/components/flow/editor/TemplateGallery.tsx` | テンプレート選択モーダル |
| `src/components/flow/editor/templates.ts` | テンプレート定義（承認フロー、PDCA、リスクアセスメント等） |
| `src/components/flow/editor/DiffPreview.tsx` | LLM生成結果の差分プレビュー（追加/変更/削除ノードをハイライト） |

### 変更ファイル

| ファイルパス | 変更内容 |
|---|---|
| `src/components/flow/FlowViewer.tsx` | AIチャットパネル用タブ/サイドバー追加 |
| `src/components/flow/FlowExportImport.tsx` | 「LLMで編集する」セクションをAIChatPanelへのリンクに置き換え |
| `src/app/api/flows/draft/route.ts` | ストリーミングレスポンス対応（SSE） |

### 受入条件
- [ ] チャットパネルで「承認フローを作って」と入力 → フローが生成されキャンバスに表示される
- [ ] 「ノードXの後にレビューステップを追加して」→ 既存フローが更新される
- [ ] 生成結果を適用前にプレビューでき、却下も可能
- [ ] テンプレートギャラリーから選択 → 即座にキャンバスに展開される
- [ ] 既存のLLMプロンプトコピー機能はエクスポートタブに残る（後方互換）

---

## Phase 4: 高度な編集機能（任意拡張）

**目標:** ユーザー体験の磨き込み。Phase 1-3で十分動作した後のオプショナルな拡張。

**スコープ候補:**
- ミニマップ表示
- グループ化（サブプロセスとして折りたたみ）
- コメント/アノテーション
- 複数ユーザー同時編集（WebSocket）
- キーボードショートカット一覧
- フロー比較（バージョン間diff）

*Phase 4は具体的なファイルリストを定めない。Phase 3完了後にユーザー要望に応じて計画する。*

---

## リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| **React Flow のSSR非互換** | Next.js Server Componentでのインポートエラー | `'use client'` ディレクティブを FlowCanvas.tsx に付与。dynamic importで遅延読み込み |
| **自動レイアウトの品質** | ノードが重なる、見づらい配置になる | dagreのrankdir/nodesep/ranksepパラメータチューニング。ユーザーが手動でドラッグ調整可能にする |
| **Flow型との往復変換でデータロス** | React Flow側にないフィールド（meta, dataClassification等）が消失 | 変換時にFlowNode.dataに全フィールドを保持。往復テストで検証 |
| **大規模フロー（100+ノード）のパフォーマンス** | レンダリング遅延 | React Flowのビューポート最適化（画面外ノードのスキップ）はデフォルト有効。必要に応じてメモ化 |
| **Mermaid併存の保守コスト** | 2系統のレンダリングを維持する負担 | Mermaidは既存の `flowToMermaid()` をそのまま使い、エクスポートタブ限定。新規開発はReact Flowに集約 |
| **ノード座標の永続化** | YAMLスキーマにposition情報がない | `meta.position: { x, y }` としてmeta内に格納。Zodスキーマ変更不要（meta は `Record<string, unknown>`） |
| **Undo/Redo の複雑性** | 操作履歴管理のバグ | useReducer + イミュータブルなスナップショットスタック。上限20件で古いものを破棄 |

---

## 実装順序の根拠

1. **Phase 1 が最重要** - Mermaidの制約（DOM操作によるクリック、レイアウト制御不可）を解消し、以降のPhaseの基盤を作る
2. **Phase 2 は Phase 1 の自然な拡張** - FlowCanvas に `editable` フラグを追加するだけで骨格ができる
3. **Phase 3 はPhase 2に依存** - 編集機能がないとLLM生成結果の「適用」ができない
4. **Phase 4 はオプション** - Phase 1-3 で実用レベルに達する

### 見積もり

| Phase | 新規ファイル | 変更ファイル | 推定規模 |
|---|---|---|---|
| Phase 1 | 8 | 4 | MEDIUM |
| Phase 2 | 5 | 5 | MEDIUM-HIGH |
| Phase 3 | 5 | 3 | MEDIUM |
| Phase 4 | TBD | TBD | TBD |

---

## Guardrails

### Must Have
- Flow型 (Zodスキーマ) は変更しない。meta フィールドを活用する
- YAML (spec/flows/*.yaml) がSSOT（Single Source of Truth）であることを維持
- 既存のパーサー (`parseFlowYaml`, `stringifyFlow`, `validateFlow`) をそのまま使用
- Mermaidエクスポート（SVG出力）は引き続き動作する
- 全カスタムノードタイプ（7種）のスタイルはコードで固定、ユーザー編集不可

### Must NOT Have
- Mermaid を閲覧時のメインレンダラーとして残さない（Phase 1完了後）
- ノードの色・形状をユーザーがカスタマイズする機能
- 新しいUIライブラリ（shadcn/ui, MUI等）の導入 - Tailwind + lucide-react で統一
- Prismaスキーマの変更（座標はYAML meta内に保持）
