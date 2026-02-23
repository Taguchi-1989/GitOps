/**
 * FlowOps - Application Bootstrap
 *
 * アプリケーション初期化処理
 */

import { auditLog } from '@/core/audit';
import { auditRepository } from '@/lib/audit-repository';
import { logger } from '@/lib/logger';
import { validateEnv } from '@/lib/env';

// 環境変数バリデーション
validateEnv();

// AuditLogにPrismaリポジトリを注入
auditLog.setRepository(auditRepository);

export function initializeApp() {
  logger.info('FlowOps application initialized');
}
