/**
 * FlowOps - Application Bootstrap
 *
 * アプリケーション初期化処理
 */

import { auditLog } from '@/core/audit';
import { auditRepository } from '@/lib/audit-repository';
import { workflowEngine, humanLoopManager, createTaskExecutor } from '@/core/orchestrator';
import { workflowRepository, approvalRepository } from '@/lib/workflow-repository';
import { logger } from '@/lib/logger';
import { validateEnv } from '@/lib/env';

// 環境変数バリデーション
validateEnv();

// AuditLogにPrismaリポジトリを注入
auditLog.setRepository(auditRepository);

// WorkflowEngine / HumanLoopManager にPrismaリポジトリとTaskExecutorを注入する。
// これが無いと本番ではワークフローが永続化されず、llm-task ノードは
// taskExecutor=null で即 failed → 承認待ち(ApprovalRequest)が一切生成されない。
workflowEngine.setRepository(workflowRepository);
workflowEngine.setTaskExecutor(createTaskExecutor());
humanLoopManager.setRepository(approvalRepository);

export function initializeApp() {
  logger.info('FlowOps application initialized');
}
