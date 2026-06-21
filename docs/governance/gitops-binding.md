# 第II部 GitOps 結合 — §10〜§12

第I部コア（ポリシー/ゲート/監査）を既存 GitHub Actions GitOps へ結合する。
**コアは「挟まれる側の都合」を知らない**まま、アダプタ層と CLI/workflow で結線する。

## 結合モード（§10）

| モード | 条件 | 本実装 |
|---|---|---|
| **in-line（同期挿入）** | ワークフローが同期ステップを許す | ✅ `.github/workflows/governance-gate.yml`（PR の required check として挿入） |
| gateway（前段配置） | 同期フックが打てない | コアは同一のまま前段サービス化で対応可（§2.1）。アダプタ無変更 |

> P0 確認事項（§10）: 現行 GitHub Actions は同期ステップを許す（既存 `ci.yml` がそう）→ **in-line を採用**。コアは両モードで不変なので後から切替可能。

## アーキテクチャ（GIT-4: 移植性の不変条件）

```
.github/workflows/governance-gate.yml   ← GitHub 固有処理（issue 起票・required check）
        │ 呼ぶ
scripts/governance-gate.ts (CLI)        ← env→GitContext、git diff 取得、exit code
        │ 使う
src/core/gitops/ (アダプタ)             ← GitHub SDK 非依存の純データ境界
        │ 合成する（一方向依存）
src/core/{ingress,egress,audit,approval} ← 第I部コア（gitops を知らない）
```

- **アダプタは GitHub Actions SDK / Octokit を import しない**。git 文脈は `GitContext`（ただのデータ）として受ける。
- **コアはアダプタに依存しない**（依存はコア→アダプタの一方向）。
- この2つの不変条件を静的 import 検査で**テスト**している（`src/core/gitops/portability.test.ts`）。

## 固有要件の実装（§11）

| ID | 要件 | 実装 |
|---|---|---|
| **GIT-1** | ゲート判定を commit SHA / PR 番号に紐づけて監査 | `runGovernanceGate` が `GITOPS_GATE` を `entityId=commitSha` + payload に PR番号/branch/repo で記録 |
| **GIT-2** | high/block でマージブロック + 承認 issue 自動起票（決裁パッケージ展開） | block/escalate 時に `renderDecisionPackage`（§5.1.2 チェックリスト + 決裁ライン）を出力 → workflow が `gh issue create` |
| **GIT-3** | 前例自動承認は過去 PR を前例ソースに（Phase 1+） | P2 の `tryAutoApprove` を CLI から呼ぶ拡張余地（既定 OFF。本結線では未有効化） |
| **GIT-4** | 三層は GitHub 固有 API に直接依存しない | アダプタ＝純データ境界、GitHub 処理は workflow に隔離。portability.test で担保 |

## 判定とマージ制御

CLI が PR 差分を入口/出口ゲートで検査し:

- `allow` → exit 0（マージ可）
- `block`（機密混入・既知危険）/ `escalate`（結合型機密・flag・high等級・**差分取得失敗の fail-safe**）→ 決裁パッケージを出力し **exit 1**（required check 失敗でマージ停止）+ 承認 issue 自動起票

判定は `GITOPS_GATE` として commit SHA / PR 番号付きで監査ログへ残る（GIT-1）。

## 運用メモ

- workflow を **required status check** に設定するとマージブロックが有効化される（リポジトリ設定）。
- `GOVERNANCE_RISK_GRADE` は repo variable で上書き可（既定 medium）。
- CLI は `ts-node -r tsconfig-paths/register` で `@/` エイリアスを解決して実行。
- DB 無し CI でも判定・exit code は機能する（監査の永続化はアプリ実行時。`auditLog.record` は repository 未設定なら graceful no-op）。

## 残課題

- GIT-3（過去 PR を前例にした自動承認）の CLI 結線は未（P2 は既定 OFF / 人間ゲート昇格が前提）。
- gateway モードの前段サービス雛形は未（in-line を採用したため。必要時にアダプタ無変更で追加）。
- issue コメント `/approve` `/reject` を承認決定（§5）に橋渡しする bot は未。
