---
name: YAML Flow Parser
description: YAMLフロー定義の解析・検証・変換を担当するスキル。Zodスキーマによる型安全と参照整合性チェックを提供。
---

# YAML Flow Parser Skill

## 概要

このスキルは FlowOps プロジェクトにおけるYAMLフロー定義ファイルの解析と検証を担当します。
Single Source of Truth（SSOT）としてのYAMLを厳密に管理します。

## 責務

1. **YAML解析**
   - `spec/flows/*.yaml` ファイルの読み込み
   - Zodスキーマによる型検証
   - 参照整合性チェック

2. **Mermaid変換**
   - YAML定義からMermaid記法への変換
   - ノードクリック用のメタデータ付与

3. **整合性チェック**
   - `flow.id` とファイル名の一致確認
   - ノードIDのユニーク性確認
   - `edges[*].from/to` が nodes に存在することの確認
   - start/endノードの存在確認
   - role/systemの辞書参照確認

## 実装パス

```
core/
├── parser/
│   ├── index.ts           # メインパーサー
│   ├── schema.ts          # Zodスキーマ定義
│   ├── validateFlow.ts    # 参照整合性チェック
│   └── toMermaid.ts       # Mermaid変換
```

## データ構造

```typescript
// spec/flows/*.yaml の構造

interface Flow {
  id: FlowID;
  title: string;
  layer: "L0" | "L1" | "L2";
  updatedAt: string;
  nodes: Record<NodeID, Node>; // 配列ではなくMap
  edges: Record<EdgeID, Edge>; // 配列ではなくMap（A案採用）
}

interface Node {
  id: NodeID;
  type: "start" | "end" | "process" | "decision" | "database";
  label: string;
  role?: string; // roles.yaml のキー
  system?: string; // systems.yaml のキー
  meta?: Record<string, any>;
}

interface Edge {
  id: EdgeID;
  from: NodeID;
  to: NodeID;
  label?: string;
  condition?: string;
}
```

## Layer定義

| Layer | 内容                               | 例                 |
| ----- | ---------------------------------- | ------------------ |
| L0    | 経営/業務の目的（WHY）と主要成果物 | ビジネス目標フロー |
| L1    | 業務プロセス（WHO/WHAT）           | 受注プロセス       |
| L2    | システム手順（HOW：入出力、API）   | API連携フロー      |

## 検証エラーコード

| コード              | 説明                           |
| ------------------- | ------------------------------ |
| `INVALID_SCHEMA`    | Zodスキーマ違反                |
| `ID_MISMATCH`       | flow.idとファイル名不一致      |
| `DUPLICATE_NODE_ID` | ノードIDの重複                 |
| `MISSING_NODE_REF`  | edgeが参照するnodeが存在しない |
| `MISSING_START_END` | start/endノードがない          |
| `UNKNOWN_ROLE`      | 辞書にないrole                 |
| `UNKNOWN_SYSTEM`    | 辞書にないsystem               |
