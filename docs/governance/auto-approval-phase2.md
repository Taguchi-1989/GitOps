# 前例自動承認 + 事後サンプル監査 — P2 / §5.1.1 / §5.2 / §5.3

ガバナンス・ハーネス仕様 Phase 2 の実装。Phase 0/1 で蓄積した前例を消費し、
**同型・同版・承認済みの前例があるときだけ**自動承認する。安全性が最重要。

## フェーズと有効化（§5.3 — 昇格は人間ゲート）

| Phase | 状態 | 有効化 |
|---|---|---|
| 0 | 全件人手 + 前例蓄積 | 既定（`enabled: false`） |
| 1 | low 等級から前例自動承認 | `APPROVAL_AUTO_APPROVE=true` + `APPROVAL_AUTO_GRADES=low`（**config変更=PR=人間ゲート**） |
| 2 | 自動承認 + 事後サンプル監査 | 上記 + `APPROVAL_AUTO_SAMPLE_RATE` |

> 有効化は env / config の変更であり、**PR レビュー（人間ゲート）を通る**。自動学習ループで勝手に有効化・等級拡大はしない（POL-4 と一貫）。`decideAutoApproval` も `tryAutoApprove` も既定で `disabled` を返す。

## 多重 fail-safe（誤承認しないことを最優先）

`decideAutoApproval`（純関数）は次のいずれかに当たれば**人手へ倒す**:

| 条件 | code | 理由 |
|---|---|---|
| 無効（既定 Phase 0） | `disabled` | 既定は人手 |
| 許可外のリスク等級 | `grade-not-allowed` | Phase 1 は low のみ |
| ポリシー版が不明 | `policy-version-unknown` | 「当時の版で妥当」を確認できない |
| 同版の前例が不足 | `insufficient-precedents` | 版不一致の前例は採用しない（今の版で過去を裁かない） |
| 却下前例が混在 | `conflicting-rejection` | 合意が割れている |
| 前例が取得上限超 | `precedent-overflow` | 全件（却下含む）を見たと保証できない → 黙って打ち切らず人手へ |
| 監査記録に失敗 | `audit-write-failed` | 証跡なき承認を作らない → 人手へ |

承認できるのは **「有効 ∧ 許可等級 ∧ 版一致の承認前例が minPrecedents 以上 ∧ 却下前例ゼロ」** のときだけ。承認時は `auto-approved by precedent #N` を監査（`AUTO_APPROVE`）へ刻む。自動承認はポリシーを書き換えない（POL-4）。

## ゴム印化の防止（§5.2 事後サンプル監査）

- 自動承認の一部を**決定論的サンプリング**（`shouldSampleAudit`、`Math.random` 不使用・再現可能）で抜き取り、**厚層(thick)**で監査に残す。§6.2 で「PDCA が見るのは厚・完全層」。人はこの厚層を事後レビューする。
- これは検査機構自身を PDCA の A（改善）に乗せる仕掛け。「誰も見ていない承認」の量産を防ぐ。
- 割合は `APPROVAL_AUTO_SAMPLE_RATE`（既定 0.1）。

## 設計・実装

- `src/core/approval/auto-approve.ts`: `decideAutoApproval`（純関数）/ `tryAutoApprove`（I/O: 前例照会＋監査）/ `loadAutoApprovalConfig`（env、既定無効）。
- `src/core/approval/sample-audit.ts`: 決定論サンプラ。
- 監査アクション `AUTO_APPROVE` を追加。前例は P0-1 の `policyVersion` カラムで版照合。

## 統合レシピ（有効化する場合のみ）

承認リクエストを人へ上げる**前**に差し込む（既定無効なので挙動は変わらない）:

```ts
import { tryAutoApprove, signatureFromContext, deriveRiskGrade } from '@/core/approval';

const res = await tryAutoApprove(
  {
    signature: signatureFromContext(context),
    policyVersion: context.policyVersion,    // ゲート/ポリシー版を渡す
    riskGrade: deriveRiskGrade(context),
  },
  { eventKey: proposalId, actor, sourceEntityId: proposalId }
);

if (res.autoApprove) {
  // auto-approved by precedent #N。人手リクエストを作らずに次へ。
  // res.sampleAudit が true のものは厚層に残り、後で人がサンプル監査する。
} else {
  // 従来どおり人手承認フロー（res.code が理由）
}
```

## 独立レビュー反映（critic）

安全性最重要のため独立 critic エージェントで敵対的レビュー。invariant 1–7 は全て HOLD と確認。発見した MAJOR 2件を是正:

- **前例の取りこぼし（conflict-safety 破れ）**: `findPrecedents` が limit 未指定で repository 既定 50 件に打ち切られ、50件超のとき却下前例を見落とす恐れ → `PRECEDENT_FETCH_LIMIT=1000` を明示し、上限到達時は黙って通さず `precedent-overflow` で**人手へ倒す**（no silent caps）。
- **証跡なき承認**: `AUTO_APPROVE` の監査書込み失敗時に承認扱いになりうる → 失敗を捕捉し `audit-write-failed` で**人手へ倒す**。承認は必ず証跡とともに。
- **シグネチャ信頼境界**: 自動承認の「同型性」は caseFeatures の質に等しい。`case-signature.ts` に信頼境界を明記（システム導出特徴のみ・自由入力を直接入れない・粗すぎる特徴禁止）。

## 残課題

- **シグネチャの schema 強制**: caseFeatures の許可フィールドを型/検証で固める（現状は規約 + コメント）。`caseType` 等のシステム割当ディスクリミネータ導入が望ましい。
- **前例の鮮度（max-age）**: 版が同じでも古すぎる前例を採用しない上限期間は未。
- **一致率の計測（Phase 1 昇格条件 §5.3）**: 蓄積前例 vs 実決定の一致率を移行根拠として算出する仕組みは未。
- **サンプル監査の人手UI**: 厚層の `AUTO_APPROVE` を一覧し人が振り返る画面は未（監査照会 API 拡張で対応可能）。
- **§8.4 心理的受容性**: 有効化は現場の信頼が前提。技術的に可能でも、合意なく Phase を上げない。
