# ガバナンス・ハーネス → FlowOps 統合設計

**文書種別**: 統合設計 / ギャップ分析（実装ロードマップ）
**読者**: 田口（ゲート承認者） / Claude Code（実装担当）
**前提資料**:
- [提案書 v0.1](governance-harness-proposal-v0.1.md)（経営層向け）
- [技術要件定義書 v0.1](governance-harness-spec-v0.1.md)（実装契約）
- [AIMS / ISO 42001 パッケージ](../aims/README.md)
**ステータス**: DRAFT（2026-06-21 作成）

---

## 0. 結論（先に言う）

**FlowOps はガバナンス・ハーネス技術仕様（第I部コア）の中核を、別名で既に実装している。** 新規にゼロから作るのではなく、既存資産を「ガバナンス・ハーネス」として**命名・接続・差分補完**するのが正しい統合方針である。

- 既存実装率（コア三層 + 差し替え可能点B）: **概算 6〜7割**
- 主たる未実装: ①**入口ゲート（機密混入検査 / Presidio相当）**、②監査ログの**コンテンツアドレス化・ポリシー版刻印・append-only強制・階層化**、③前例自動承認（Phase 1+）
- 実装先（第II部 GitOps結合）: FlowOps自体が自前TSオーケストレータのため、提案書の「器は借り、統治は持つ」のうち**統治層＝FlowOps本体**に相当する。器（Claude Code/Codex）は差し替え可能点Aとして外側に置く構図。

> 移植性原則（spec §2.1）に照らすと、FlowOpsの三層は既に「LLMを呼ばない純関数ゲート + 宣言的ポリシーYAML + 監査ログ」として分離されており、抽象境界は概ね守られている。

---

## 1. 仕様 → 既存資産マッピング

| ハーネス仕様 | FlowOps の既存資産 | 状態 |
|---|---|---|
| **§3 ポリシー・エンジン**（POL-1 宣言的 / POL-2 版付き / POL-4 人間ゲート） | `spec/gates/*.yaml`、`spec/validation-rules/*.yaml`、`spec/assumptions/*.yaml` + `src/core/orchestrator/gate-loader.ts` / `gate-registry.ts` / `rule-loader.ts` | ✅ 宣言的YAML・`version`フィールドあり・変更はPR人間ゲート。⚠ Rego推奨だがYAMLで成立。各版の**ハッシュ刻印が未実装** |
| **§4.2 出口/受入ゲート**（決定論・LLM不使用） | `src/core/orchestrator/gate-evaluator.ts`（純関数 `evaluateGate`、severity×passed→outcome） | ✅ 実装済み。`noRulesMatched: watch` 等で安全側寄せの素地あり |
| **§4.1 入口ゲート**（機密混入検査・結合型マスキング・fail-safe） | — | ❌ **未実装**（最大の差分）。`spec/gates/safety-review-gate.yaml` は出力側のISO 12100網羅性ゲートで、入力側の機密検査ではない |
| **§5 承認ワークフロー**（判断は人・記録は機械） | `src/core/orchestrator/human-loop.ts`、Decision Card、`issue-management` スキル（承認issue自動起票） | ✅ 全件人手（Phase 0）の素地あり。⚠ 前例自動承認・サンプル監査は未実装 |
| **§6 階層化監査ログ** | `src/core/audit/`（`logger.ts` / `types.ts`）、`prisma` `AuditLog` モデル、`src/lib/trace-context.ts`（AsyncLocalStorage） | ✅ 配管・traceId・payload・index あり。⚠ LOG-1〜4 の**ハッシュ / ポリシー版 / append-only強制 / 階層化・時間減衰が未実装** |
| **差し替え可能点B**（LiteLLM一枚） | `infrastructure/litellm/config.yaml`、`src/core/llm/client.ts`（直叩き禁止・ゲートウェイ経由） | ✅ ほぼ達成。提案書 DoD の「設定一行でプロバイダ切替」に最も近い |
| **差し替え可能点A**（器のアダプタ） | `src/core/orchestrator/`（自前TS）。Claude Code/Codex は外側の器 | △ コアは器非依存。アダプタ境界の明文化は将来課題 |
| **§8.2 値型機密の抽象化経路** | `src/core/data/`（`DataObject`、監査アクション `ABSTRACTION_APPLIED` / `PROVENANCE_RECORDED`、GPTsiteki §8.6） | ✅ 値→抽象化サマリの素地あり。ローカル変換器の明示は要確認 |
| **ガバナンス文書 / 監督義務** | `docs/aims/`（AIMSポリシー・ISO42001統制マッピング・リスク評価）、`spec/aims/controls.yaml` | ✅ ISO 42001 統制として整備済み。本ハーネスはその技術的実装に対応 |

---

## 2. ギャップ詳細（埋めるべき差分）

### G1. 入口ゲート（機密混入検査） — [P0 / 最大の差分] ✅ 実装済
- 実装: `src/core/ingress/`（`scanner.ts` 純関数 / `types.ts` バージョン付きポリシー / `policy-loader.ts` YAML+既定フォールバック / `guard.ts` 監査結線）。ポリシー源 `spec/gates/ingress-secret-gate.yaml`。
- 結合型→マスキング、値型/判定不能→block（人間承認フローへ）。LLMを呼ばない（ING-3）。`evaluateGate` とは別ロジック（OUTG-2 多様性）。
- 結線: 提案生成 `route.ts` で `generateProposal` 前に `guardIngress`、block時 422 `INGRESS_BLOCKED`（LLM未送出）。判定は `INGRESS_GATE` として監査（policyVersion/policyHash/severity、実体は載せない）。
- 独立セキュリティレビュー反映: ReDoS耐性（量指定子上限＋100KB上限block）、二段走査（順序非依存）、パターン拡張。spec不変条件は全PASS。

### G2. 監査ログの仕様強化 — [P0]
現 `AuditLog`（`prisma/schema.prisma:144`）に対し:
- **LOG-1 コンテンツアドレス**: `payload` を直接保存せず、`contentHash`(sha256) + 外部ストレージ参照へ。重複排除（LOG-2）が自動で効く。
- **LOG-4 ポリシー版刻印**: `policyVersion` / `policyHash` カラム追加。判定が「どのポリシー版で」下されたかを再現可能に。
- **LOG-3 append-only強制**: DBレベル（権限/トリガ）でUPDATE/DELETEを禁止。現状はアプリ規約のみ。
- **§6.2 階層化 + §6.3 時間減衰**: 薄/厚/完全の3層と、薄ログの日次サマリ畳み込み。
- 既存の強み: `traceId`（E2Eトレース）、`GATE_EVALUATE` / `HUMAN_APPROVE` / `HUMAN_REJECT` アクションは既に定義済み（`types.ts:38-39`）。配管はある。

### G3. ポリシー版のハッシュ化 — [P0]
- POL-2: 各YAMLゲート/ルール版に**ハッシュと発効時刻**を持たせる。現 `version: "1.0.0"` に加え、ロード時に内容ハッシュを算出し監査ログへ刻む（G2と連動）。

### G4. 前例自動承認 + サンプル監査 — [P1〜P2]
- spec §5.1.1 / §5.2 / §5.3。Phase 0（全件人手・前例蓄積）は `human-loop` で開始可能。Phase 1+ の前例自動承認・ランダムサンプル監査は新規。
- §8.4 の通り**技術問題ではなく現場の信頼問題**。段階的主権移譲（Phase 0→1→2）を厳守。

---

## 3. 段階的実装ロードマップ（spec §9 を FlowOps 文脈へ）

> 原則: **監査ログ配管が最優先**。FlowOpsは配管が既にあるため、まず「仕様準拠への強化（G2/G3）」から入る。

| 段階 | 作業 | 対象 | 既存/新規 |
|---|---|---|---|
| **P0-1** ✅ | 監査ログを仕様準拠へ（hash・policyVersion・severity層・append-only方針） | `src/core/audit/*`、`prisma/schema.prisma`、[append-only](audit-append-only.md) | 実装済 |
| **P0-2** | ポリシー版ハッシュ刻印（ロード時に算出しゲート評価で刻む） | `gate-loader.ts` / `rule-loader.ts`（GATE_EVALUATE での `policyHash` は P0-1 で先行） | 強化 |
| **P0-3** ✅ | 入口ゲート（決定論検出 + fail-safe + 二段走査 + ReDoS耐性） | `src/core/ingress/*`、`spec/gates/ingress-secret-gate.yaml`、提案生成routeへ結線 | 実装済 |
| **P0-4** ✅ | 差し替え可能点B 受け入れ確認（直叩き是正・一行切替） | `src/core/llm/*`、[swappable-point-b](swappable-point-b.md) | 検証済 |
| **P1** ✅ | 出口ゲート（独立検出系: ルール+エントロピー） | `src/core/egress/*`、[egress-gate](egress-gate.md) | 実装済 |
| **P1** ✅ | 承認ワークフロー Phase 0（全件人手 + 前例蓄積） | `src/core/approval/*` + `human-loop.ts`、[approval-phase0](approval-phase0.md) | 実装済 |
| **P2** ✅ | 前例自動承認 + 事後サンプル監査 | `src/core/approval/auto-approve.ts` `sample-audit.ts`、[auto-approval-phase2](auto-approval-phase2.md) | 実装済 |

### 第II部 GitOps 結合（結合モード）
- spec §10: in-line / gateway の二モード。FlowOpsは自前オーケストレータのため**in-line（同期挿入）が自然**。ゲート判定を commit SHA / PR番号に紐づけ（GIT-1）、`high` 等級でマージブロック + 承認issue自動起票（GIT-2、既存 `issue-management` を流用）。

---

## 4. 未解決リスク（spec §8 の FlowOps への適用）

- **§8.1 出口ゲートはゼロデイ非担保**: 出口検査を「安全性の担保」と説明しない。`docs/aims/` の表現と一貫させる。
- **§8.2 値型機密**: `src/core/data` の抽象化経路を値型専用とし、ローカル変換器必須を明文化。マスキング経路を値型に流用しない。
- **§8.3 再識別**: 結合型ポリシー設計時に「単独無害の足し上げ≠結合無害」を明記。
- **§8.4 前例自動承認の受容性**: Phase 0 で十分に前例と一致率を貯めてから移行。現場合意なしに自動化しない。

---

## 5. 受け入れ基準（spec §12 を FlowOps で確認）

- [x] 監査ログが素通し状態でも全判定を追記し、**ポリシー版・時刻・ハッシュ**を刻む（P0-1）
- [x] 判定不能時に安全側へ倒れるテストが通る（POL-3 / ING-2 — 入口ゲート fail-safe テスト）
- [x] 差し替え可能点Bで設定一行のプロバイダ切替が三層コード無変更で成立（P0-4 / [swappable-point-b](swappable-point-b.md)）
- [ ] ポリシー変更が人間ゲート（PR）を通らずに反映される経路が存在しない（POL-4 — YAMLはPR管理だが自動学習ループ禁止の明文ガードは未）
- [ ] §8 の全リスクがレビューされ受容判断が記録されている（§8.1/8.2 は egress/ingress 文書で言及。正式な受容記録は未）

> 進捗サマリ: **P0(P0-1/P0-3/P0-4) + P1(出口ゲート/承認Phase0) + P2(前例自動承認+サンプル監査) 完了。** ロードマップ主要項目は全て実装済。残: P0-2(ポリシー版ハッシュのロード時刻印を全ルールへ)、P1b(CVEシグネチャ)、§8リスクの正式受容記録、POL-4自動学習禁止の明文ガード、第II部 GitOps結線(GIT-1/2)、自動承認の有効化判断（一致率計測・現場合意）。

---

## 6. 関連ドキュメント

- [AIMS README](../aims/README.md) / [ISO42001統制マッピング](../aims/iso42001-control-mapping.md) — ガバナンス上位枠組み
- [AI統合アーキテクチャ](../architecture-ai-integration.md) — 5層プラットフォーム設計
- [DecisionOps オペレーティングモデル](../decisionops-operating-model.md) — 承認ワークフローの運用思想
- `spec/gates/safety-review-gate.yaml` — 既存ゲート実装の参照例
- [監査ログ append-only](audit-append-only.md)（P0-1）/ [入口ゲート補足](#g1-入口ゲート機密混入検査--p0--最大の差分-実装済)（P0-3）
- [差し替え可能点B](swappable-point-b.md)（P0-4）/ [出口ゲート](egress-gate.md)（P1）/ [承認 Phase 0](approval-phase0.md)（P1）

---

*v0.1 — 数値・施行時期は原典（2026-06作成）準拠。下流実装前に spec §8 未解決リスクの受容判断を完了すること。*
