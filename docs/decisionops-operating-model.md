# DecisionOps 運用モデル

判断ロジックを「資料」ではなく「動く仕様」として育てるための運用。
日常で叩き、週次で標準化し、月次で成熟度を見る。

---

## 守るべき5つのルール

### Rule 1: LLM 出力は正本ではない
```
LLM出力 = 提案
Git上の YAML / Script / Test = 正本
```

### Rule 2: 人が確認していないロジックは本番適用しない
```
draft → reviewed → approved → active → deprecated
```
タスク/ルール/ゲート/前提に lifecycle ステージを持たせる。active だけが本番。

### Rule 3: 計算式は必ず version を持つ
```
formula_id / formula_version / assumption_id / input_dataset_id / output_hash
```
ゲート評価は `gateId`/`gateVersion` と前提スナップショットを `GateEvaluation`（DB）と
`AuditLog`(`GATE_EVALUATE`) に二重記録する。後から監査できないロジックは作らない。

### Rule 4: 現場ごとの可変層を許す
```
普遍層: 価値ノード構造 / 受入ゲート / 監査ログ / 変更理由 / 人の承認
可変層: KPI / 閾値 / 危険源 / センサ / PLC/DCS構造 / 現場ルール
```
全部を標準化しようとすると失敗する。

### Rule 5: 差し戻しは失敗ではなく資産
```
rejected / revise / hold / stop / watch
```
判断品質を上げるためのデータとして扱う。

---

## 日常運用

```
1. 現場・生産技術が Issue を起票（重い作業 / 分からないPLCロジック / 属人化した試運転項目 / ROIを見たい 等）
2. Issue type を選ぶ（flow-change / decision-review / roi-estimation / safety-review /
   acceptance-gate / plc-dcs-visualization / pipeline-change）
3. Intake（LLM）が入力を構造化（対象工程・作業・目的・制約・関係者・必要データ・リスクレベル）
4. パイプライン候補を選ぶ（対象タスク/ゲート）
5. 決定論 Runner が実行（ワークフロー実行 → タスク → Acceptance Gate 評価）
6. Agent が結果を説明（何が分かったか / どの前提か / どの証跡が不足か / どのゲートで止まっているか）
7. 人が Decision Card（/approvals/[id]）で確認
8. 修正が必要なら Proposal 化
9. JSON Patch / Script / Test を Git commit
10. AuditLog に残す
```

現状の実体: `POST /api/workflows {flowId:'risk-assessment-detail'}` → `ai_hazard_identification`
実行直後に `safety-review-gate` が発火 → `/approvals` に承認待ちが出る → Decision Card で
式・前提・gate結果・不足証跡を見て承認/差し戻し（理由必須）。

---

## 週次運用 — 判断ロジックの改善会

Issue を捌くのではなく、**ロジックを標準化**する会。

見るもの:
```
今週出たIssue / 重複Issue / 差し戻しが多いGate / 証跡不足が多いPipeline /
人が毎回修正している計算式 / 適用範囲外が多いルール / 現場から反発があった言い方
```
やること（プロンプト改善ではなく、ロジックの標準化）:
```
人が毎回直している → 判断ルールとして抽出 → YAML化/Script化 → Test追加 → 次回から自動チェック
```

---

## 月次運用 — 判断能力の成熟度レビュー

経営・安全・生産技術視点で見る（開発進捗ではなく判断能力の成熟度）:
```
どの判断パイプラインが使われたか / どの案件が Go/Revise/Hold/Stop/Watch になったか /
どの前提がよく変わるか / どの工程で信頼レベルが上がったか /
どのPLC/DCS可視化が現場メリットを出したか / どの判断が横展開できそうか
```

---

## 今年の到達点

```
目的: GitOps を、業務フロー管理から Physical AI Engineering OS の判断パイプライン基盤へ進化させる。
到達点: 1工程で、判断パイプラインが1回通る。
```
今年やらないこと: ロボット実機接続を主目的にしない / 全社展開を最初から狙わない /
完璧な価値判断ツリーを作ろうとしない / LLM に最終判断させない / 認証取得そのものを成果にしない。

関連: [decisionops-evolution.md](decisionops-evolution.md) /
[agent-first-deterministic-pipeline.md](agent-first-deterministic-pipeline.md)
