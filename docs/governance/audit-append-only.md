# 監査ログ append-only 強制（LOG-3）

ガバナンス・ハーネス仕様 LOG-3「ログは追記専用（append-only）。改竄不能性を担保」の実装方針。

## 二層で担保する

### 1. アプリケーション層（実装済み）

`IAuditLogRepository`（`src/core/audit/logger.ts`）が公開するのは **`create` / `findMany` / `count` のみ**。`update` / `delete` を一切定義しない。Prisma 実装（`src/lib/audit-repository.ts`）も同様で、`auditLog.update` / `auditLog.delete` を呼ぶ経路がコード上に存在しない。

- 監査記録には `contentHash`（LOG-1/2）・`policyVersion` / `policyHash`（POL-2/LOG-4）・`severity`（§6.2）が常に刻まれる。
- `contentHash` は payload の sha256（キー順非依存）。同一内容は同一ハッシュ → 重複排除（LOG-2）。

### 2. データベース層（本番 PostgreSQL で適用）

開発は SQLite（`provider = "sqlite"`、`prisma db push` 運用）。本番 PostgreSQL では、アプリの DB ロールから `AuditLog` への UPDATE / DELETE 権限を剥奪し、トリガで二重に塞ぐ。`prisma migrate` 導入後は下記を SQL マイグレーションに含める。

```sql
-- AuditLog を追記専用にする（PostgreSQL）
-- 1) アプリ用ロールから UPDATE/DELETE を剥奪（SELECT/INSERT のみ許可）
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog" FROM flowops_app;
GRANT  SELECT, INSERT          ON "AuditLog" TO   flowops_app;

-- 2) 万一の特権経路も塞ぐトリガ（所有者でも改竄不可）
CREATE OR REPLACE FUNCTION audit_log_reject_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only (governance harness LOG-3)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();
```

> ロール名 `flowops_app` は環境のアプリ用 DB ユーザに置換する。

## 残課題

- **db push 運用のため、上記 SQL は自動適用されない。** `prisma migrate` 導入時に正式マイグレーションへ取り込む（または運用 Runbook で手動適用）。
- 実体（payload）の外部ストレージ退避（LOG-1 完全形）は本フェーズ未対応。現状は payload を保持しつつ `contentHash` を併記。退避は後続フェーズ（P0-1b）。
- 薄ログの時間減衰・日次サマリ畳み込み（§6.3）は後続フェーズ（P0-1c）。`severity = 'thin'` 行が対象。
