/**
 * FlowOps - Application Bootstrap
 * 
 * アプリケーション初期化処理
 */

import { auditLog } from '@/core/audit';
import { auditRepository } from '@/lib/audit-repository';

// AuditLogにPrismaリポジトリを注入
auditLog.setRepository(auditRepository);

export function initializeApp() {
  console.log('[FlowOps] Application initialized');
}
