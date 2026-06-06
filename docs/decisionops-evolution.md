# FlowOps → DecisionOps → Physical AI Engineering OS 進化方針

> 合言葉: **GitOps を、判断ロジックが育つ場所にする。**

FlowOps を「業務フロー管理ツール」で完成させるのではなく、最初から
**判断ロジックを育てる器** として進化させる。LLM は判断者ではなく、
「Issue を構造化し、差分案を作り、証跡不足を指摘する補助者」。
正本は Git 上の YAML / Script / Test であり、**人が確認したロジックだけ**が次版に反映される。

```
業務/技術の違和感
  → Issue化
  → LLMで差分案
  → 人が確認（Decision Card）
  → Gitで正本更新
  → 監査ログに残す
  → 次の版が賢くなる
```

普通のAIツールは「AIが答える → 間違っていたら終わり」。
FlowOps は「AIが叩き台 → 人が違和感 → Issue → Patch → Git → 同じ間違いをしにくくなる」。
**間違いを資産に変える仕組み**であることが勝ち筋。

---

## レイヤの進化

| 段階 | 内容 |
|---|---|
| **FlowOps** | 業務フローを Git で育てる（`spec/flows/*.yaml`） |
| **DecisionOps** | 価値判断・安全レビュー・ROI・受入条件を Git で育てる |
| **Physical AI Engineering OS** | PLC/DCS・試運転・現場データ・Human Gate・AIMS/ISO 証跡まで Git で育てる |

```
FlowOps (業務フローYAML / Issue / Patch / Git Commit / AuditLog)
      ↓ 拡張
DecisionOps (Value Tree / ROI / Safety Review / Acceptance Gate / Evidence)
      ↓ 接続
Physical AI Engineering OS (PLC/DCS / 試運転 / 現場データ / Human Gate / AIMS証跡)
```

---

## 既存資産マップ（重要 — 「新設」ではなく「繋いで埋める」）

このリポジトリは README 記載より進化しており、ビジョンの部品の多くが**別名で既に存在**する。
DecisionOps は並行構造を新設せず、既存を拡張する（DRY）。

| ビジョンの部品 | 実態（再利用元） |
|---|---|
| Deterministic Runner | `src/core/orchestrator/engine.ts`（状態機械）+ `task-executor.ts` |
| Pipeline Registry | `task-registry.ts` + `task-loader.ts`（`spec/tasks` 走査+キャッシュ） |
| Human Gate | engine の human-review ノード + `ApprovalRequest` + `POST /api/workflows/[id]/approve` |
| Evidence Graph | `DataObject`/`CrossReference`/`DataEvidenceLink`/`TransformationEvent`（Prisma） |
| Safety Review | `hazard-identification`/`risk-estimation`/`risk-reduction-advisor` タスク + `risk-assessment-detail.yaml` |
| 監査・Trace | `AuditLog`(traceId) + AsyncLocalStorage（`src/lib/trace-context.ts`） |
| PLC/DCS 可視化 | 別途準備（後フェーズで Evidence として接続） |

### SSOT（崩さない核）
```
Git = 正本（spec/flows, spec/tasks, spec/validation-rules, spec/gates, spec/assumptions）
DB  = 派生（Issue / ワークフロー実行 / 監査 / Gate評価の表示キャッシュ）
```
DB を正本にしない。Git-first → DB-second（DB更新は Git commit 成功後のみ）。

---

## 成熟度の階段（現在地）

| Lv | 名称 | 状態 |
|---|---|---|
| Lv0 | FlowOps（業務フローYAML） | ✅ |
| Lv1 | IssueOps（違和感をIssue化） | ✅ |
| Lv2 | PatchOps（LLM差分→人確認→commit） | ✅ |
| Lv3 | **DecisionOps（判断ロジックをYAML化）** | ✅ 本MVPで着手（Safety + Gate + Decision Card） |
| Lv4 | PipelineOps（承認済みロジックを決定論Runnerで実行） | 🔜 ROI が次 |
| Lv5 | EvidenceOps（PLC/DCS・試運転・現場/原価データ接続） | スキーマ有・接続は後 |
| Lv6 | AgentOps（Issue/Pipeline/Evidence/Gate のオーケストレーション） | 後 |
| Lv7 | AIMSOps（AI利用・リスク・人の監督・変更・監査を自然に残す） | ISO 42001 土台有 |

**順番が重要**: いきなり AgentOps をやらない。判断ロジックを YAML 化 → 決定論 Runner で動かす
→ 人が確認 → その後に Agent が叩く。

---

## 本MVPで実装したもの（Lv3 の最初の縦切り）

「既存の `risk-assessment-detail` フローを1回通し、人が Decision Card で承認/差し戻し理由を記録し、
監査に式・前提・ゲート結果が残る」を成立させた。

- **Acceptance Gate（決定論・非LLM）**: `spec/validation-rules/*.yaml` を評価し、
  `Go / Revise / Hold / Stop / Watch` を判定。
  - スキーマ: `src/core/orchestrator/schemas/{validation-rule,gate,assumption,lifecycle}.ts`
  - ローダ/レジストリ: `rule-loader`/`rule-registry`/`gate-loader`/`gate-registry`/`assumption-loader`
  - 評価器（純関数）: `rule-evaluator.ts`（completeness）/ `gate-evaluator.ts`（severity集約→outcome）
  - spec: `spec/gates/safety-review-gate.yaml` + `spec/assumptions/safety-review-assumptions.yaml`
    （既存 `spec/validation-rules/iso-12100-coverage-check.yaml` を評価）
- **エンジン統合**: `engine.ts` の llm-task 実行直後に gate を評価し、`GATE_EVALUATE` 監査 +
  `GateEvaluation`(DB) に記録。`outcome=stop` は人手前で機械停止。
- **Decision Card / Validation Workspace**: `/approvals`・`/approvals/[id]`
  （`src/components/approval/DecisionCard.tsx`）。目的・前提・入力・式（gate結果）・出力・
  不足証跡を一画面で見せ、承認/差し戻し（理由必須）を既存 approve API へ。
- **前提の load-bearing 修正**: `bootstrap.ts` で WorkflowEngine / HumanLoopManager に
  Prisma リポジトリと TaskExecutor を注入（これが無いと承認待ちが生成されない既存バグ）。

---

## 次の一歩

1. **ROI 試算 pipeline（Lv4）**: 決定論的（非LLM）式 runner を `data-transform`/`conditional`
   タスク実行パスとして実装。`spec/tasks/roi-estimation.yaml` + `spec/assumptions/labor-cost-*.yaml`。
2. **Excel/CSV グリッド編集（超重要）**: フロー(nodes/edges)を表計算グリッドで編集できる第2のUIを
   ノード編集と並列で。**正本は YAML/Git**、グリッドは入出力のみ（既存 patch→branch→commit に合流）。
3. **PLC/DCS 可視化の Evidence 接続（Lv5）**: 別途準備済みの可視化を `DataObject`/`DataEvidenceLink`
   経由で Decision Card の証跡に紐づける。

関連: [agent-first-deterministic-pipeline.md](agent-first-deterministic-pipeline.md) /
[decisionops-operating-model.md](decisionops-operating-model.md)
