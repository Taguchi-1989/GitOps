/**
 * FlowOps - Audit Log Types
 *
 * 監査ログ関連の型定義
 */

import { z } from 'zod';

// --------------------------------------------------------
// Audit Actions
// --------------------------------------------------------
export const AuditActionSchema = z.enum([
  // Issue lifecycle
  'ISSUE_CREATE',
  'ISSUE_UPDATE',
  'ISSUE_START',
  'ISSUE_CLOSE',
  'ISSUE_DELETE',

  // Proposal lifecycle
  'PROPOSAL_GENERATE',
  'PATCH_APPLY',

  // Git operations
  'MERGE_CLOSE',
  'DUPLICATE_MERGE',
  'GIT_COMMIT',
  'GIT_BRANCH_CREATE',
  'GIT_BRANCH_DELETE',

  // System operations
  'BACKUP_CREATE',
]);

export type AuditAction = z.infer<typeof AuditActionSchema>;

// --------------------------------------------------------
// Entity Types
// --------------------------------------------------------
export const AuditEntityTypeSchema = z.enum(['Issue', 'Proposal', 'Flow', 'Evidence', 'System']);

export type AuditEntityType = z.infer<typeof AuditEntityTypeSchema>;

// --------------------------------------------------------
// Audit Log Entry
// --------------------------------------------------------
export interface AuditLogEntry {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  payload?: Record<string, unknown>;
  actor?: string;
}

// --------------------------------------------------------
// Audit Query Options
// --------------------------------------------------------
export interface AuditQueryOptions {
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
