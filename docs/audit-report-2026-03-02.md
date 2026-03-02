# FlowOps 監査レポート

> 監査日: 2026-03-02
> 対象: FlowOps リポジトリ全体
> 観点: アーキテクチャ、業務フロー設計プロセス、構造計算ケース適用、改善提案

---

## 1. 総合評価

| 領域 | 評価 | 備考 |
|------|------|------|
| アーキテクチャ設計 | A | SSOT=YAML + GitOps の原則が一貫している |
| 型安全性 | A | Zod + TypeScript strict mode で堅牢 |
| 業務フロー表現力 | B | L1フローは十分だがL0/L2の実例・制約が弱い |
| 構造計算的検証 | C | フローの「構造的正しさ」検証が不十分（後述） |
| 業務フロー作成プロセス | C | 新規フロー作成の導線・ガイドが未整備 |
| 監査・追跡 | B+ | AuditLogは実装済みだが粒度と照会UIに課題 |
| ワークフロー実行基盤 | B | エンジンは動くが条件評価が簡易すぎる |
| テストカバレッジ | C | コアのみ。API/UI/E2E未整備 |
| セキュリティ | C | 認証・CORS・CSRF未実装（quality-improvement-planで認識済み） |

---

## 2. 構造計算ケース：設計時にフローの「正しさ」をどう検証するか

### 2.1 現状の問題

現在 `validateFlow.ts` が行っている検証:

```
[実装済み]
- Edge参照の存在チェック（from/toがnodesに存在するか）
- Start/Endノードの存在確認
- 辞書参照チェック（role/system）
- 孤立ノード検出（警告のみ）
- 到達可能性チェック（startからのBFS、警告のみ）
```

**不足している「構造計算」に相当する検証:**

### 2.2 提案: フロー構造の健全性チェック（Structural Integrity Analysis）

建築の構造計算が「荷重→応力→許容値」を数値で検証するように、
業務フローにも「構造的に破綻していないか」を定量的に検証すべき。

#### A. デッドロック検出（循環参照で終了しないパス）

```
現状: 未実装
リスク: decision → process → decision のループで
        endに到達しないパスが存在しうる

提案:
- endへの到達可能性チェック（全ノードからendへのパスが存在するか）
- 無限ループ検出（条件なしの循環パスを検出）
- WorkflowEngine の maxSteps=100 に頼るのではなく、
  コンパイル時に静的検出すべき
```

#### B. 分岐網羅性チェック（Decision Coverage）

```
現状: decisionノードの出力エッジに条件があるか未検証
リスク: 在庫確認ノードに「在庫あり」「在庫なし」以外の
        状態（例: 確認不能）がありうるのにフローで未考慮

提案:
- decisionノードには最低2本の出力エッジを必須化
- デフォルトパス（condition無し）の存在を推奨 or 必須化
- edge.condition の排他性・網羅性を警告レベルで検出
```

#### C. SLA整合性チェック

```
現状: meta.sla は自由テキスト（「当日中」「24時間以内」）
リスク: 上流ノードのSLAが下流より厳しい場合、
        フロー全体のSLAが破綻する

提案:
- SLAを構造化（数値 + 単位: { value: 24, unit: "hours" }）
- パス上のSLA累積チェック（合計がフロー全体SLAを超えないか）
- これは「構造計算」の直接的なアナロジー
```

#### D. ロール・権限の構造チェック

```
現状: roleの存在チェックのみ
リスク: エスカレーションフローでsupervisor → support への
        降格遷移が意図しない権限問題を起こす

提案:
- roles.yaml にレベル（level）属性を追加
- エスカレーションパスでレベル降格がある場合に警告
- 承認ノード（human-review）の前に適切な権限ロールがあるか検証
```

#### E. システム境界チェック（Integration Point Analysis）

```
現状: systemの存在チェックのみ
リスク: CRM → WMS → 基幹システム とシステムを跨ぐ際の
        データ変換やエラーハンドリングが考慮されていない

提案:
- systems.yaml に type: internal/external を活用
- external システムへの遷移時に
  「エラーハンドリングノード」の存在を推奨
- システム間のデータフロー（入出力）の型整合性チェック
```

### 2.3 実装イメージ: validateFlow.ts への追加

```typescript
// 提案する追加チェック関数群

/** A. 全ノードからendへの到達可能性 */
function checkEndReachability(flow: Flow): ValidationWarning[]

/** B. Decision Coverage: 分岐の網羅性 */
function checkDecisionCoverage(flow: Flow): ValidationWarning[]

/** C. SLA累積パス分析 */
function checkSlaConsistency(flow: Flow): ValidationWarning[]

/** D. ロール権限遷移チェック */
function checkRoleTransitions(flow: Flow, dictionary: Dictionary): ValidationWarning[]

/** E. システム境界分析 */
function checkSystemBoundaries(flow: Flow, dictionary: Dictionary): ValidationWarning[]

// 統合: 既存のvalidateFlowIntegrity に組み込み
export function validateFlowStructure(
  flow: Flow,
  dictionary?: Dictionary,
  options?: { level: 'strict' | 'standard' | 'lenient' }
): StructuralAnalysisResult {
  return {
    integrity: validateFlowIntegrity(flow, dictionary),
    reachability: checkEndReachability(flow),
    decisionCoverage: checkDecisionCoverage(flow),
    slaAnalysis: checkSlaConsistency(flow),
    roleTransitions: checkRoleTransitions(flow, dictionary),
    systemBoundaries: checkSystemBoundaries(flow, dictionary),
  };
}
```

---

## 3. 業務フロー自体を作るときのプロセス

### 3.1 現状の問題

現在、新しい業務フローを作成する方法が**未定義**:

```
現在のフロー:
1. 誰かが spec/flows/xxx.yaml を手書きする
2. 既存フローに対するIssue → LLM提案 → パッチ適用

欠けていること:
- 新規フローをゼロから作る導線がない
- フロー設計のベストプラクティスが未文書化
- L0 → L1 → L2 の段階的詳細化プロセスが未定義
- 業務ヒアリング → YAML化の変換支援がない
```

### 3.2 提案: フロー作成パイプライン

#### Phase 1: ヒアリング → L0（目的・成果物の定義）

```yaml
# 提案: spec/flows/templates/l0-template.yaml
id: "{flow-id}"
title: "{フロー名}"
layer: L0
updatedAt: "{ISO8601}"

nodes:
  objective:
    id: objective
    type: start
    label: "{業務目的}"
    meta:
      kpi: []           # 達成指標
      stakeholders: []   # 関係者
      triggers: []       # 発動条件

  outcome:
    id: outcome
    type: end
    label: "{期待成果物}"
    meta:
      deliverables: []   # 成果物リスト
      quality_criteria: [] # 品質基準

edges:
  e1:
    id: e1
    from: objective
    to: outcome
```

**L0ではノードが2-3個でよい。** 目的と成果物を明確にすることが目的。

#### Phase 2: L0 → L1（業務プロセスへの展開）

```
LLMアシスト案:
  入力: L0フロー + ヒアリングメモ（テキスト）
  出力: L1フローのドラフト（nodes/edges 展開）

  プロンプト戦略:
  「以下のL0フロー（目的と成果物）を、WHO（誰が）WHAT（何を）の
   業務プロセスに分解してください。各ノードにはroleとsystemを
   割り当て、decisionポイントを明示してください。」
```

#### Phase 3: L1 → L2（システム手順への詳細化）

```
LLMアシスト案:
  入力: L1フロー + systems.yaml
  出力: L2フローのドラフト（システム操作レベルの詳細化）

  各L1ノードを展開:
  - 「受注受付」→「画面入力」→「バリデーション」→「DB登録」→「通知送信」
```

### 3.3 提案: 新規フロー作成API

```
現在のAPIに不足しているエンドポイント:

POST /api/flows/create
  body: { id, title, layer, template?: "blank" | "l0" | "l1" }
  → spec/flows/{id}.yaml を生成 + git commit

POST /api/flows/{id}/expand
  body: { targetLayer: "L1" | "L2", context: string }
  → LLMがフローを展開してProposalとして返す
  → 既存のProposal/Apply/Mergeサイクルに乗せる

POST /api/flows/{id}/validate-structure
  → 構造計算（セクション2）の結果を返す
```

### 3.4 提案: フロー設計ガイド（ドキュメント）

```
docs/flow-design-guide.md として以下を文書化:

1. フロー設計の5ステップ
   ① 目的の明確化（L0作成）
   ② 業務プロセスの洗い出し（L1作成）
   ③ 構造検証（セクション2のチェック）
   ④ システム手順への落とし込み（L2作成）
   ⑤ レビュー＆Issue作成

2. ノード設計のルール
   - processノード: 1つのアクション、1つのロール
   - decisionノード: 必ず2つ以上の出力エッジ
   - start/endノード: フローに必ず1つずつ

3. エッジ設計のルール
   - conditionの記法統一
   - デフォルトパスの設置推奨
   - ループの最大回数制限

4. メタデータの活用
   - SLAの記載ルール
   - descriptionの必須化
   - priority/escalation_levelの活用
```

---

## 4. 監査ログの改善

### 4.1 現状

- AuditLog は全操作を記録する設計
- actor は MVP では `"you"` 固定
- payload は `Record<string, unknown>` で非構造化

### 4.2 改善提案

#### A. 監査ログのペイロード標準化

```typescript
// 現状: payload が自由形式
payload: { flowId: "order-process" }

// 提案: アクションタイプごとにペイロードスキーマを定義
type AuditPayloadMap = {
  ISSUE_CREATE: { title: string; targetFlowId?: string };
  PATCH_APPLY: {
    flowId: string;
    patchCount: number;
    baseHash: string;
    newHash: string;
  };
  WORKFLOW_START: {
    flowId: string;
    initiatorId: string;
    inputSummary: string;
  };
  HUMAN_APPROVE: {
    reason: string;
    decidedBy: string;
    autoApprovalEligible: boolean;
  };
};
```

#### B. 監査照会APIの強化

```
現状: GET /api/audit でフラットなリスト返却のみ

提案:
GET /api/audit/timeline/{entityId}
  → あるIssue/Flowの時系列イベントストリーム

GET /api/audit/trace/{traceId}
  → ワークフロー実行全体の追跡
  （これは GET /api/governance/trace/{traceId} として部分実装済み）

GET /api/audit/stats
  → 集計ダッシュボード用（アクション別件数、期間別推移）

GET /api/audit/export
  → CSV/JSON形式での監査ログエクスポート（コンプライアンス用）
```

#### C. 不変性の保証

```
現状: AuditLogに対するDELETEやUPDATE制限が未実装

提案:
- AuditLog テーブルへの UPDATE/DELETE を
  アプリケーションレベルで禁止（ミドルウェアで拒否）
- 将来的にはappend-onlyストレージ
  （EventSourcing的なアプローチ）を検討
```

---

## 5. ワークフローエンジンの改善

### 5.1 条件評価の強化

```typescript
// 現状: engine.ts の evaluateCondition は極めて簡易
// "key == value" と "key != value" と truthy判定のみ

// 問題:
// - "stock > 0" のような数値比較が未対応
// - 複合条件（AND/OR）が未対応
// - edge.condition の文法が未定義

// 提案: 条件式のDSLを定義
// spec/flows/*.yaml の condition フィールドの文法を明文化:
//
// 単純比較:    field == "value" | field != "value"
// 数値比較:    field > 0 | field >= 10 | field < 100
// 存在チェック: field.exists | !field.exists
// 複合:        field == "a" AND other > 0
//
// Zodスキーマで condition 文字列をパース・検証する
```

### 5.2 エラーリカバリ

```
現状: ノード処理失敗 → ワークフロー全体が failed
提案:
- ノードレベルのリトライポリシー（task.maxRetries は存在するが
  エンジンレベルでのfallbackパスが未定義）
- 「エラー時の遷移先エッジ」を定義可能にする
  例: edge に onError: true 属性を追加
- 手動再開ポイントの指定
  （現在は paused-human-review のみ）
```

---

## 6. YAML フロー定義の改善

### 6.1 order-process.yaml の具体的な問題

```yaml
# 問題1: roleが日本語と英語で不統一
# order-process.yaml: role: 営業, role: 倉庫
# shipping-process.yaml: role: warehouse
# inquiry-handling.yaml: role: support
#
# roles.yaml では英語キー（sales, warehouse）で定義されている
# → order-process.yaml の「営業」「倉庫」は辞書参照エラーになるはず

# 問題2: systemも不統一
# order-process.yaml: system: CRM, system: WMS, system: 基幹システム, system: メール
# systems.yaml では crm, wms, erp として定義
# → 大文字/日本語名で不一致

# 問題3: 在庫なし → 顧客通知 で終了するが、
# 欠品時の代替アクション（発注提案、代替品提案）がない
```

### 6.2 condition式の改善

```yaml
# 現状: condition: stock > 0
# engine.ts の evaluateCondition は "key == value" しか評価できない
# → stock > 0 は評価不能でデフォルト true になる

# 提案: condition を正規化
edges:
  e3:
    id: e3
    from: check_stock
    to: process_order
    label: 在庫あり
    condition: stock_available == "true"  # 文字列比較に統一
```

---

## 7. セキュリティ改善（quality-improvement-plan との整合）

quality-improvement-plan.md で認識済みの項目に加え:

```
追加の懸念:
1. evaluateCondition が文字列ベースの評価 → インジェクションリスク
   （現在の実装は正規表現ベースで安全だが、
    将来的にeval的な拡張をすると危険）

2. LLM出力のJSON抽出（extractJson）でブレース{...}を
   最初にマッチ → 巧妙に構成されたLLM応答で
   意図しないデータが抽出される可能性
   → Zodバリデーション層で防御されているが、
     明示的なサニタイズレイヤーを追加推奨

3. TaskExecutor が response_format: "json_object" を
   ハードコードしているが、全LLMプロバイダーが対応していない
   → llm/client.ts との整合性を確認
```

---

## 8. 優先度付き改善アクションリスト

### P0（即時対応）

| # | 改善項目 | 影響範囲 | 工数 |
|---|---------|---------|------|
| 1 | order-process.yaml の role/system を辞書キーに統一 | spec/flows/ | S |
| 2 | condition式の実装と定義を一致させる | engine.ts, フロー定義 | S |
| 3 | validateFlow の警告をAPIレスポンスに含める | validateFlow.ts, API | S |

### P1（次スプリント）

| # | 改善項目 | 影響範囲 | 工数 |
|---|---------|---------|------|
| 4 | 構造計算チェック追加（デッドロック検出、分岐網羅） | validateFlow.ts | M |
| 5 | フロー作成API（POST /api/flows/create） | API, git | M |
| 6 | テンプレートYAML（L0/L1/L2）の整備 | spec/flows/templates/ | S |
| 7 | 監査ログペイロードの型付け強化 | audit/types.ts | S |
| 8 | 条件式DSLの定義とパーサー実装 | 新規 core/condition/ | M |

### P2（今後のスプリント）

| # | 改善項目 | 影響範囲 | 工数 |
|---|---------|---------|------|
| 9 | L0→L1展開のLLMアシスト | API, LLM prompts | L |
| 10 | SLA構造化と累積チェック | schema.ts, validateFlow | M |
| 11 | フロー設計ガイド文書化 | docs/ | M |
| 12 | 監査ログのtimeline/export API | API, lib | M |
| 13 | エラーリカバリパスの定義 | engine.ts, schema | L |

---

## 9. まとめ

### 強み（維持すべき点）
- SSOT=YAML + GitOps の原則が一貫して実装されている
- Zod による型安全が入出力境界で徹底されている
- Mutex Lock + baseHash で並行操作の安全性を確保
- LLM出力の検証（禁止パス、辞書チェック）が実装済み
- 監査ログが全操作に組み込まれている

### 最大の課題
1. **「構造計算」の欠如**: フローが構造的に正しいかの静的検証が不十分。到達可能性やデッドロック検出がログ出力のみで、フロー定義の品質を保証できていない
2. **新規フロー作成プロセスの不在**: 既存フローへの修正パイプラインは優秀だが、ゼロからフローを設計するプロセスが未定義
3. **辞書参照の不統一**: order-process.yaml がroles/systems辞書と不一致（日本語名 vs 英語キー）

---

*工数目安: S=1-2日, M=3-5日, L=1-2週間*
