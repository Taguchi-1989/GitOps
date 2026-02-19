/**
 * FlowOps - Application Bootstrap
 * 
 * アプリケーション初期化処理
 */

import { auditLog } from '@/core/audit';
import { auditRepository } from '@/lib/audit-repository';
import { logger } from '@/lib/logger';

// AuditLogにPrismaリポジトリを注入
auditLog.setRepository(auditRepository);

export function initializeApp() {
  logger.info('FlowOps application initialized');
}
