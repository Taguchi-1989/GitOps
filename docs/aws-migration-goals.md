# AWS移行 目標ドキュメント（FlowOps / 東京リージョン）

## 1. 目的
- このプロジェクトをAWS上で安定運用できる状態にする。
- 検証環境と本番環境の2系統（ダブル環境）で運用する。
- デプロイ、テスト、リリース判定を標準業務フローとして固定化する。

## 2. 前提（確定）
- リージョン: `ap-northeast-1`（東京）
- 環境: `staging` / `production`
- 方針: まず `staging` を先に完成させ、運用手順を確立してから `production` に展開する。

## 3. ゴール（完了条件）
- `staging` と `production` が `ap-northeast-1` で稼働している。
- `main` マージで `staging` へ自動デプロイされる。
- `production` は手動承認付きでデプロイできる。
- 品質ゲート（`typecheck` / `lint` / `test` / `build`）を通過しないとデプロイされない。
- CloudWatchでログ監視・アラート運用ができる。

## 4. 推奨アーキテクチャ（初期）
- 実行基盤: ECS Fargate（Webアプリ）
- DB: Amazon RDS for PostgreSQL
- 静的アセット: S3（必要ならCloudFront）
- シークレット管理: AWS Systems Manager Parameter Store または Secrets Manager
- 監視: CloudWatch Logs / Metrics / Alarms

補足:
- SQLiteのまま本番運用は非推奨。可用性と運用性のためPostgreSQLに移行する。

## 5. 標準業務フロー
1. 機能ブランチで実装
2. Pull Request作成
3. CIで `typecheck` / `lint` / `test` / `build`
4. レビュー承認後 `main` マージ
5. `staging` へ自動デプロイ
6. スモークテスト（`/api/health`、主要API、主要画面）
7. 本番デプロイ承認
8. `production` へデプロイ
9. デプロイ後5〜15分監視して完了

## 6. セキュリティ方針（機密情報）
- `.env` の機密値はGitに入れない。
- AWS上の機密値は Parameter Store / Secrets Manager で管理する。
- IAMは最小権限にする。
- CloudTrailを有効化して変更履歴を追える状態にする。

## 7. 初心者向け: あなたが最初にやる操作（理由つき）

### 7.1 AWSアカウント初期設定
1. MFAを有効化する  
理由: アカウント乗っ取り対策の最重要項目。
2. 管理者用IAMユーザーを作る（root常用禁止）  
理由: rootの常用は事故時の影響が大きい。
3. AWS請求アラート（予算アラート）を設定する  
理由: 想定外コストの早期検知。

### 7.2 東京リージョン固定
1. マネジメントコンソール右上で `Asia Pacific (Tokyo)` を選択  
理由: すべての作業を同じリージョンに揃えるため。
2. CLIプロファイルを設定（後述コマンド）  
理由: CLI操作時にリージョンミスを防ぐため。

### 7.3 まず必要な情報（あなたに確認したい項目）
- AWSアカウントID
- 請求上限の目安（月額）
- 通知先メールアドレス（障害/請求）
- ドメイン利用有無（例: `example.com`）
- GitHubリポジトリ（CI/CD連携先）

## 8. あなたの操作手順（CLI）
以下はあなたがローカルで実行する最小セットです。

```bash
# 1) AWS CLIインストール確認
aws --version

# 2) 認証情報を設定（対話形式）
aws configure
# AWS Access Key ID: <IAMユーザーのキー>
# AWS Secret Access Key: <IAMユーザーのシークレット>
# Default region name: ap-northeast-1
# Default output format: json

# 3) 設定確認
aws sts get-caller-identity
aws configure get region
```

期待結果:
- `aws sts get-caller-identity` であなたのアカウント情報が返る。
- `aws configure get region` が `ap-northeast-1` になる。

## 9. 実行計画（次の2週間）
1. Day 1-2: アカウント初期設定（MFA, IAM, 予算アラート）
2. Day 3-4: `staging` 基盤作成（VPC, ECS, RDS, Secrets）
3. Day 5-7: アプリ接続（PostgreSQL移行、環境変数整理）
4. Day 8-10: CI/CD連携（`main`→`staging`自動デプロイ）
5. Day 11-14: スモークテストと運用手順Fix

## 10. 次に私がサポートする内容
- あなたの操作ごとに「この画面でどこを押すか」を順番に案内する。
- 実行コマンドの結果を見て、次コマンドを都度指定する。
- 機密情報は貼らず、マスクして共有してもらう形式で進める。

機密情報の共有ルール:
- Access Key / Secret / パスワード / トークンは貼らない。
- 共有時は末尾4文字だけ見える形にする（例: `****ABCD`）。

