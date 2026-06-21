# 承認ワークフロー Phase 0（全件人手 + 前例蓄積） — P1 / §5

ガバナンス・ハーネス仕様 §5 の Phase 0 実装。**判断は人・記録は機械**。

## 原則（§5.3）

| Phase | 状態 | 本実装 |
|---|---|---|
| **0** | **全件人手承認**。前例を溜めるだけ溜める | ✅ 本実装 |
| 1 | 一致率がしきい値超で low 等級から前例自動承認 | ❌ まだ（蓄積した前例を消費する） |
| 2 | 自動承認 + 事後サンプル監査 | ❌ まだ |

> **Phase 0 では自動承認しない。** 本モジュールは前例の「記録」と「照会」だけを提供し、`findPrecedents` の結果から自動 Yes を出すコードは存在しない。各フェーズ昇格は人間ゲート（POL-4 と一貫）。

## 三点セット（§5.1）

1. **判断と記録の分離（§5.1.3）**: 承認者は `approved` + 一言理由のみ（既存 `ApprovalDecision`）。機械が**案件シグネチャ・リスク等級・ポリシー版・時刻・主体**へ展開して前例化する。
2. **リスク等級別の決裁ライン（§5.1.2）**: `requiredApprovalLine(grade)` で `low→team-lead / medium→manager / high→executive`。全件を最高権限者に上げない。
3. **前さばき自動化（§5.1.1）**: Phase 1 の機能。前例コーパス（本実装で蓄積）を参照する素地のみ用意。

## 設計：前例は監査ログの上に乗せる（専用テーブル不要）

前例コーパスを別テーブルにせず、**append-only 監査ログ**（P0-1 で改竄不能・版刻印済み）に蓄積する:

```
action        = 'PRECEDENT_RECORD'
entityId      = 'precedent:<signature>'   ← 案件の同型性キー（indexed で高速照会）
policyVersion = 当時のポリシー版            ← 版が変われば前例は流用不可（§5.1.1）
severity      = high等級→thick / それ以外→thin
payload       = { signature, riskGrade, approved, reason, decidedBy, sourceEntityId }
```

- **案件シグネチャ**: `caseSignature(features)`（キー順非依存 sha256）。`context.caseFeatures` があればそれだけで同定し、時刻や決定など可変フィールドの影響を受けない。
- **照会**: `findPrecedents(signature, policyVersion)` が `entityId` + `policyVersion` で監査ログを引く（P0-1 で追加した `policyVersion` カラムをそのまま活用）。

## 結線

- `src/core/approval/`（`case-signature.ts` / `precedent.ts` / `types.ts`）
- `src/core/orchestrator/human-loop.ts`: `submitDecision` で人手決定を記録した直後に `recordPrecedent`。判断は人、前例展開は機械。
- 監査アクション `PRECEDENT_RECORD` を追加。

## 残課題（§8.4 の心理的受容性）

- Phase 1（前例自動承認）への昇格は、人間判断と機械推奨の**一致率**がしきい値を超えてから。これは技術問題ではなく**現場の信頼**の問題（§8.4）。一致率の計測は蓄積した前例 vs 実決定で算出可能（将来）。
- GIT-2（high 等級でマージブロック + 承認 issue 自動起票）は GitOps 結線側（第II部）の課題として別途。
