# Agent-first / Deterministic-pipeline 設計原則

DecisionOps の最重要原則は、**LLM に判断させない**こと。
エージェント（LLM）は決定論的パイプラインを叩くオーケストレーターであり、判断者ではない。

```
LLM / Agent がやること:
  - 相談を構造化する（Issue化）
  - 不足情報を聞く
  - YAML 差分案を作る
  - 承認者向けに要約する
  - 証跡不足を指摘する

LLM / Agent がやらないこと:
  - 最終判断
  - 安全承認
  - 投資承認
  - 現場価値の断定
```

この線引きを最初に強く置く。

---

## 役割分担

| 層 | 担当 | 実装 |
|---|---|---|
| 構造化・差分案・要約 | LLM タスク | `spec/tasks/*.yaml`（`type: llm-inference`）, `task-executor.ts` |
| ルール評価 | **決定論（純関数）** | `rule-evaluator.ts`（LLM不使用・I/Oなし・例外を投げない） |
| 受入判定 | **決定論（純関数）** | `gate-evaluator.ts`（severity集約 → policy表 → outcome） |
| 最終判断 | **人** | Decision Card（`/approvals/[id]`）で承認/差し戻し（理由必須） |

`gate-evaluator` の `outcome=go` でも**自動承認しない**。Gate 結果は参考情報であり、
最終判断は必ず人が Decision Card で行う。UI にもその旨を明示している。

---

## なぜ決定論か

- **監査可能性**: 同じ入力に同じ出力。後から「どの式・どの前提で、なぜその判定になったか」を追える。
- **再現性**: ロジックが Git 上の YAML/Script/Test に固定され、バージョン管理される。
- **責任の所在**: 判定（機械）と決断（人）を分離する。AIMS / ISO 42001 の「人の監督」と整合。

```
draft → reviewed → approved → active → deprecated
```
判断ロジック（タスク/ルール/ゲート/前提）には lifecycle ステージを持たせる
（`src/core/orchestrator/schemas/lifecycle.ts`）。**人が確認した active のロジックだけ**を本番適用する
（現状は土台。enforcement は後フェーズ）。

---

## Acceptance Gate の判定（Go/Revise/Hold/Stop/Watch）

`gate-evaluator.ts` は、各バリデーションルールの結果（`ValidationResult`）を集約し、
未合格のうち**最も重い severity** を `spec/gates/*.yaml` の `policy` 表に当てて outcome を決める。

| 条件 | policy キー | 既定 outcome | 意味 |
|---|---|---|---|
| 致命的ルール不合格 | `onCritical` | `stop` | 機械的に停止（人手前で止める） |
| 重大ルール不合格 | `onError` | `hold` | 保留 |
| 軽微ルール不合格 | `onWarning` | `revise` | 是正のうえ再評価 |
| 全合格 | `allPassed` | `go` | 次フェーズへ |
| 評価対象ルール無し | `noRulesMatched` | `watch` | 判断保留（要観察） |

`stop` のみエンジンがワークフローを機械停止する（`engine.ts`）。それ以外は通常どおり
human-review に進み、人が Decision Card で最終判断する。

**差し戻しは失敗ではなく資産**: `revise`/`hold`/`stop`/`watch` や人の差し戻しは、
判断品質を上げるためのデータとして扱う（ネガティブに扱わない）。

---

## 値の流れ（安全側に倒す）

`rule-evaluator.ts` のフィールドパス解決（例 `hazards[].category`）は、
欠損・型不一致・null を黙ってスキップし、例外を投げない。決定論かつ安全側。
判定の前提（しきい値・カテゴリの根拠）は `spec/assumptions/*.yaml` に集約し、
評価時にスナップショットを `GateEvaluation`（DB）と Decision Card に残す。

関連: [decisionops-evolution.md](decisionops-evolution.md) /
[decisionops-operating-model.md](decisionops-operating-model.md)
