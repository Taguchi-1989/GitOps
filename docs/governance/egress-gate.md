# 出口ゲート（出力検査） — P1 / §4.2

ガバナンス・ハーネス仕様 §4.2（OUTG-1〜3）の実装。ハーネス出力（LLM生成の提案）を
**入口ゲートとは独立した検出系**で検査し、既知危険を確率的に削減する。

## 位置づけ（OUTG-3 — 重要）

本ゲートが担保するのは **「既知危険の削減」と「判定の監査可能性」** であって、
**安全性そのものではない**。

- **ゼロデイ（未知の悪意あるコード）検出は担保しない。** 売り文句の柱にしない。
- 出口を緩さの言い訳にしない（「出口があるから入口は緩くてよい」設計は禁止）。漏洩防止の主役は入口（§4.1）。
- 出口の主目的の一つは **入口の誤りを検知する二重化トリップ**（§4.2）。秘密検出を入口と独立に再実装しているのはこのため。

## 独立性（OUTG-2）

入口ゲートのロジックを再利用していない（`src/core/ingress` を import しない）。手法も変えている:

| | 入口（§4.1） | 出口（§4.2） |
|---|---|---|
| 主手法 | ポリシー駆動の正規表現でマスク/ブロック | カテゴリ別ルール **＋ エントロピー**で finding を分類 |
| 出力 | pass / mask / block | pass / flag / block |
| 秘密検出 | 結合型=マスク, 値型=block | 独立定義の二重化トリップ（high=block）＋未知形式はエントロピーで拾う |

## 検出カテゴリと判定

| カテゴリ | 例 | severity | 判定 |
|---|---|---|---|
| secret | PEM秘密鍵 / AWSキー / GitHub・Slackトークン | high | block |
| command-injection | `rm -rf /` / `; drop table` / `$(...)` / `curl … \| sh` | high | block |
| script-injection | `<script>` / `eval(` / `javascript:` | high | block |
| high-entropy | 未知形式の高エントロピー文字列（秘密候補） | medium | flag |
| path-traversal | `../../` | medium | flag |
| suspicious-url | 平文http / 生IPのURL | medium | flag |

- high が1件でも → **block**（`full` 層で監査、Proposalを永続化しない）
- medium のみ → **flag**（`thick` 層で監査、通すが要レビュー）
- なし → **pass**（`thin` 層）

## 実装と結線

- `src/core/egress/`（`rules.ts` 手書きルール＋エントロピー / `scanner.ts` 構造化出力を走査する純関数 / `guard.ts` 監査結線）
- 提案生成 `route.ts`: `generateProposal` の直後・永続化の直前に `guardEgress`。block時 422 `EGRESS_BLOCKED`、Proposal未保存。判定は `EGRESS_GATE` として監査（ruleId/category/field/count のみ、実体は非保持）。
- ハードニング: 過大リーフ（>100KB）は走査せず high として block（fail-safe）。エントロピー検出は ASCII 秘密文字集合に限定し自然言語（CJK含む）の誤検出を回避。

## 残課題

- 既知CVEシグネチャ（依存パッケージの脆弱バージョン等）は現状未対応。提案出力がコード差分でなくフロー差分のため優先度低。将来コード生成を扱う場合に拡張（P1b）。
- ルールセットの版管理は `guard.ts` の `RULESET_VERSION` + `hashPolicy(EGRESS_RULES)` で監査に刻む。YAML外出しは将来課題。
