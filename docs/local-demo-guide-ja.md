# ローカルデモ手順と運用ガイド（FlowOps）

この資料は、以下を1本で説明するためのものです。
- ローカルサーバーの立ち上げ方
- 画面/機能がどう動くか
- データをどこに置くべきか
- 拡張時にどう運用するか

## 1. ローカルサーバー起動

前提
- Node.js 18+
- Git

手順
```bash
npm install
cp .env.example .env.local
npx prisma db push
npm run dev
```

アクセス先
- `http://localhost:3000`

`.env.local` 最低限
- `DATABASE_URL=file:./dev.db`
- `LLM_PROVIDER=openai`
- `LLM_API_KEY=...`

## 2. デモで見せる流れ（5-10分）

1. Flow一覧を見る
- `GET /api/flows` で `spec/flows/*.yaml` が読まれて一覧化される

2. Issueを作る
- 画面: `/issues/new`
- API: `POST /api/issues`
- `targetFlowId` を指定して、どのフローを直すか明示

3. 作業開始（ブランチ作成）
- API: `POST /api/issues/{id}/start`
- `cr/ISS-xxx-...` ブランチを作成し、Issueを `in-progress` に更新

4. 提案生成（LLM）
- API: `POST /api/issues/{id}/proposals/generate`
- 対象YAML + 辞書（role/system）から JSON Patch 提案を生成
- Issueは `proposed` へ

5. 提案適用
- API: `POST /api/proposals/{id}/apply`
- `spec/flows/{flowId}.yaml` を更新し、Git commit 実行

6. マージしてクローズ
- API: `POST /api/issues/{id}/merge-close`
- `main` にマージして作業ブランチ削除
- Issueを `merged` に更新

## 3. データはどこに上げるべきか（保存先の整理）

### 3.1 正本データ（最重要）
- 保存先: `spec/flows/*.yaml`
- 理由: このプロジェクトは YAML を SSOT（唯一の正本）として扱う
- 運用: 変更は最終的に Git commit / push で共有

### 3.2 辞書データ（role/system）
- 保存先: `spec/dictionary/roles.yaml`, `spec/dictionary/systems.yaml`
- 用途: LLM提案時の語彙制約、入力品質の安定化

### 3.3 業務ログ/Issue管理データ
- 保存先: `prisma/dev.db`（SQLite）
- 内容: Issue, Proposal, Evidence, AuditLog
- 注意: ローカルDBは共有されないため、チーム共有したい場合はDB運用方針を別途定義（将来的にPostgreSQL移行を推奨）

### 3.4 証跡ファイル（画像・ログ）
- 現状: ファイルアップロードAPIは未実装。Evidenceは `url` 文字列管理
- 推奨:
  - 容量が軽いもの: リポジトリ管理（必要最小限）
  - 画像/大容量ログ: S3/Drive/社内ストレージに置き、IssueにURLを記録

## 4. 拡張時の運用（今後の開発で説明しやすい型）

1. 変更単位を Issue 化
- まず `/issues/new` で目的と対象Flowを固定

2. ブランチを自動作成して作業
- `/start` でブランチ作成
- 手で別ブランチを切るより、Issueと履歴の対応が崩れにくい

3. 提案は必ず差分レビュー
- `/proposals/generate` の結果をレビュー
- そのまま適用せず、意図・影響・ノード参照を確認

4. 適用後はテスト/型チェック
```bash
npm run test
npm run typecheck
npm run lint
```

5. マージ後に共有
- `merge-close` 後に `git push origin main`
- 必要なら `cr/...` ブランチの履歴も保持

## 5. 相手に説明するときの短いトーク例

- 「Flowの正本はYAMLです。UIはその編集インターフェースで、最終的にはGit履歴で統制します。」
- 「Issueを起点にブランチを作り、LLM提案をPatchとしてレビューしてから適用します。」
- 「適用時にYAML更新とコミットを自動化し、最後にmainへマージして完了です。」
- 「データ配置は、正本=spec/flows、運用データ=SQLite、証跡ファイル=外部ストレージURL管理が基本です。」

## 6. 補足（このリポジトリ基準の実体）

- フロー読込/保存: `src/lib/flow-service.ts`
- Issue作成: `src/app/api/issues/route.ts`
- 作業開始: `src/app/api/issues/[id]/start/route.ts`
- 提案生成: `src/app/api/issues/[id]/proposals/generate/route.ts`
- 提案適用: `src/app/api/proposals/[id]/apply/route.ts`
- マージクローズ: `src/app/api/issues/[id]/merge-close/route.ts`
- Git操作: `src/core/git/manager.ts`
- DBスキーマ: `prisma/schema.prisma`
