# FlowOps 品質改善計画

> 分析日: 2026-02-20
> 対象: FlowOps v0.1.0 (MVP)
> ファイル数: 79 TypeScript + 設定ファイル群

---

## 現状評価サマリー

| カテゴリ | スコア | 本番Ready | 備考 |
|---------|--------|----------|------|
| コード品質 | 8/10 | Yes | clean architecture, 型安全 |
| 型安全性 | 9/10 | Yes | strict mode, Zod, any使用2箇所のみ |
| エラーハンドリング | 8/10 | Yes | 統一レスポンス, カスタムError |
| セキュリティ | 6/10 | **No** | 認証/認可なし, CORS制限なし |
| テスト | 5/10 | **No** | コアのみ, API/UI未カバー |
| ドキュメント | 8/10 | Yes | README充実, API仕様書なし |
| 可観測性 | 2/10 | **No** | console.logのみ |
| CI/CD | 0/10 | **No** | パイプラインなし |
| スケーラビリティ | 5/10 | **No** | SQLite単一接続 |

**総合本番Ready度: 約40%**

---

## P0: クリティカル（本番デプロイ前に必須）

### 1. 認証・認可の実装
- **現状**: APIルートに認証なし。誰でもアクセス可能
- **対応**:
  - [ ] NextAuth.js導入（GitHub/Google OAuth）
  - [ ] セッション管理ミドルウェア追加
  - [ ] RBAC（ロールベースアクセス制御）実装
  - [ ] APIルートへの認証ガード適用
- **影響ファイル**: `src/app/api/**`, `src/middleware.ts`（新規）
- **工数目安**: L

### 2. CORS・CSRF対策
- **現状**: `next.config.js`で全オリジン許可（`*`）、CSRF保護なし
- **対応**:
  - [ ] CORS許可オリジンを明示的に制限
  - [ ] CSRF トークン検証の実装
  - [ ] セキュリティヘッダー追加（CSP, X-Frame-Options等）
- **影響ファイル**: `next.config.js`, `src/middleware.ts`
- **工数目安**: M

### 3. APIレート制限
- **現状**: レート制限なし。DoS攻撃に脆弱
- **対応**:
  - [ ] upstash/ratelimit または独自実装でレート制限追加
  - [ ] LLM生成エンドポイントは特に厳しい制限（コスト保護）
  - [ ] レート制限超過時の適切なレスポンス（429）
- **影響ファイル**: `src/middleware.ts`, `src/lib/rate-limit.ts`（新規）
- **工数目安**: S

### 4. CI/CDパイプライン構築
- **現状**: GitHub Actionsなし。手動デプロイのみ
- **対応**:
  - [ ] `.github/workflows/ci.yml` 作成
    - lint（ESLint）
    - format check（Prettier）
    - type check（tsc --noEmit）
    - テスト実行（vitest）
    - カバレッジレポート
  - [ ] PRマージ時の自動チェック
  - [ ] mainブランチへの直接pushを禁止
- **影響ファイル**: `.github/workflows/`（新規）
- **工数目安**: M

### 5. 構造化ログ導入
- **現状**: `console.log`のみ（28箇所）。ログレベルなし
- **対応**:
  - [ ] Pino導入（Next.js互換、高速）
  - [ ] ログレベル設定（error/warn/info/debug）
  - [ ] リクエストID付きのリクエストログ
  - [ ] console.log → logger への置換
- **影響ファイル**: `src/lib/logger.ts`（新規）, 全APIルート
- **工数目安**: M

---

## P1: 高優先度（次スプリント）

### 6. テストカバレッジ拡充
- **現状**: コアロジック7ファイルのみ（API/UIテストなし）
- **対応**:
  - [ ] APIルートテスト追加（全11エンドポイント）
  - [ ] React コンポーネントテスト追加（React Testing Library）
  - [ ] カバレッジ閾値設定（core/ 80%以上）
  - [ ] CI でカバレッジチェック
- **影響ファイル**: `src/app/api/**/*.test.ts`（新規）, `src/components/**/*.test.tsx`（新規）, `vitest.config.ts`
- **工数目安**: L

### 7. API仕様書（OpenAPI）
- **現状**: READMEに簡易記載のみ。型情報なし
- **対応**:
  - [ ] OpenAPI 3.0スキーマ作成
  - [ ] Swagger UI統合（`/api-docs`）
  - [ ] Zodスキーマから自動生成検討（zod-to-openapi）
- **影響ファイル**: `src/app/api-docs/`（新規）, `openapi.yaml`（新規）
- **工数目安**: M

### 8. DBマイグレーション整備
- **現状**: `prisma db push`のみ（開発用）。マイグレーション履歴なし
- **対応**:
  - [ ] `prisma migrate dev` への切り替え
  - [ ] 既存スキーマの初期マイグレーション作成
  - [ ] デプロイ時 `prisma migrate deploy` 自動実行
  - [ ] ステータスフィールドをenum化
- **影響ファイル**: `prisma/migrations/`（新規）, `prisma/schema.prisma`
- **工数目安**: S

### 9. エラートラッキング導入
- **現状**: エラーは console.error のみ。障害の発見が遅延
- **対応**:
  - [ ] Sentry SDK導入
  - [ ] エラー境界コンポーネント（React Error Boundary）
  - [ ] サーバー/クライアント両方のエラーキャプチャ
  - [ ] Slack通知連携
- **影響ファイル**: `src/lib/sentry.ts`（新規）, `src/app/layout.tsx`, `src/app/error.tsx`（新規）
- **工数目安**: M

### 10. pre-commit フック
- **現状**: コミット前のチェックなし
- **対応**:
  - [ ] husky + lint-staged 導入
  - [ ] コミット時: lint, format, type check
  - [ ] コミットメッセージ規約（Conventional Commits）
- **影響ファイル**: `.husky/`（新規）, `package.json`
- **工数目安**: S

---

## P2: 中優先度（今後のスプリント）

### 11. PostgreSQL移行
- **現状**: SQLite（単一ファイル、単一接続）
- **理由**: マルチユーザー対応、同時接続、JSON型カラム
- **対応**:
  - [ ] PostgreSQL Docker設定
  - [ ] Prismaプロバイダー切り替え
  - [ ] コネクションプーリング設定
  - [ ] JSONカラム型の活用（jsonPatch, payload）
- **工数目安**: M

### 12. キャッシュレイヤー
- **現状**: キャッシュなし。毎回ファイルI/O + DB
- **対応**:
  - [ ] Redis / Upstash Redis 導入
  - [ ] フロー一覧のキャッシュ（TTL: 5分）
  - [ ] ダッシュボード統計のキャッシュ
- **工数目安**: M

### 13. ソフトデリート
- **現状**: ハードデリート（データ復旧不可）
- **対応**:
  - [ ] `deletedAt` カラム追加
  - [ ] Prismaミドルウェアでフィルタリング
  - [ ] 復旧APIエンドポイント追加
- **工数目安**: S

### 14. レスポンス圧縮・パフォーマンス
- **対応**:
  - [ ] gzip/brotli圧縮
  - [ ] API レスポンスのカーソルベースページネーション統一
  - [ ] 大量データのストリーミングレスポンス
- **工数目安**: S

### 15. i18n対応
- **現状**: 日本語UIだがハードコーディング
- **対応**:
  - [ ] next-intl 導入
  - [ ] エラーメッセージの国際化
  - [ ] UIテキストの外部化
- **工数目安**: M

---

## P3: 低優先度（Nice to Have）

### 16. E2Eテスト
- [ ] Playwright導入
- [ ] クリティカルパスのE2Eテスト（Issue作成→提案→適用→マージ）
- **工数目安**: L

### 17. シークレット管理
- [ ] AWS Secrets Manager / Vault 統合
- [ ] API キーのローテーション機構
- **工数目安**: M

### 18. DBバックアップ自動化
- [ ] 定期バックアップスクリプト
- [ ] リストア手順ドキュメント
- **工数目安**: S

### 19. 型安全性の微調整
- [ ] `z.any()` → `z.unknown()` 変更（schema.ts）
- [ ] Branded Types導入（FlowID, NodeID）
- [ ] `@typescript-eslint/no-explicit-any` ルール追加
- **工数目安**: S

### 20. 依存関係の自動更新
- [ ] Dependabot / Renovate 設定
- [ ] セキュリティアラート対応フロー
- **工数目安**: S

---

## 実行ロードマップ

```
Sprint 1 (Week 1-2): P0 セキュリティ・基盤
  ├── #1 認証・認可
  ├── #2 CORS・CSRF
  ├── #3 レート制限
  ├── #4 CI/CD
  └── #5 構造化ログ

Sprint 2 (Week 3-4): P1 品質・信頼性
  ├── #6 テスト拡充
  ├── #8 DBマイグレーション
  ├── #9 エラートラッキング
  └── #10 pre-commit フック

Sprint 3 (Week 5-6): P1-P2 ドキュメント・スケール
  ├── #7 API仕様書
  ├── #11 PostgreSQL移行
  └── #12 キャッシュ

Sprint 4+ : P2-P3 改善
  ├── #13-#15 (P2項目)
  └── #16-#20 (P3項目)
```

---

## 補足: 現在の強み（維持すべき点）

- **クリーンアーキテクチャ**: core/lib/app の分離が明確
- **型安全性**: strict mode + Zod で実行時・コンパイル時両方をカバー
- **エラーハンドリング**: 統一されたAPIレスポンス、カスタムErrorクラス
- **Git操作の安全性**: Mutex Lock + タイムアウト + 自動リリース
- **監査ログ**: 全操作の追跡可能性
- **Docker対応**: 非rootユーザー、マルチステージビルド
- **LLM安全性**: プロンプト制約 + 出力バリデーション

---

*工数目安: S=1-2日, M=3-5日, L=1-2週間*
