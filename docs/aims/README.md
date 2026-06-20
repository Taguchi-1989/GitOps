# FlowOps AIMS — ISO/IEC 42001 運用パッケージ

AI ガバナンスを「動く仕様」として回すための入口。新規に作らず、既存実体に AIMS の名前を付け直す。

## 構成

| ファイル | 役割 | ISO 42001 |
|---|---|---|
| [aims-policy.md](aims-policy.md) | AI方針＋運用ルール（正本） | 5.2, A.2 |
| [iso42001-control-mapping.md](iso42001-control-mapping.md) | 適用宣言書(SoA) | Annex A |
| [risk-and-impact-assessment.md](risk-and-impact-assessment.md) | リスク・影響評価手順 | 6.1, 8.2-8.4, A.5 |
| [spec/aims/controls.yaml](../../spec/aims/controls.yaml) | SoA データ正本 | Annex A |
| [.github/ISSUE_TEMPLATE/](../../.github/ISSUE_TEMPLATE/) | 起票テンプレ | 6.1, 8.x, 10 |

## 既存実体との対応

| AIMS 要求 | FlowOps 実体 |
|---|---|
| AI方針 (5.2/A.2) | DecisionOps 5ルール |
| 役割・責任 (5.3/A.3) | PDCA 簡易RACI |
| リスク評価 (6.1.2/8.2) | risk-assessment フロー＋受入ゲート |
| 影響評価 (6.1.4/A.5) | safety-review ゲート＋assumptions |
| ライフサイクル (8.x/A.6) | draft→reviewed→approved→active→deprecated |
| データ (A.7) | 辞書＋sensitivity-levels |
| 追跡可能性 (A.6.2.8) | AuditLog＋traceId＋GateEvaluation 二重記録 |
| 人間監督 (A.9) | Decision Card（理由必須の承認/差し戻し） |
| 継続改善 (10.2) | 改善バックログ PDCA |

## 起票導線

| 事象 | Issue 種別 (label) |
|---|---|
| AI固有リスク | `aims:risk` |
| 個人/集団/社会への影響 | `aims:impact` |
| ルール/管理策の逸脱・インシデント | `aims:nonconformity` |
| AIシステム/ロジック変更 | `aims:change` |
| ガバナンス改善 | `aims:improvement` |

## レビュー周期

週次=監視(9.1) / 四半期=内部監査・SoA更新(9.2) / 月次=マネジメントレビュー(9.3)。
