/**
 * FlowOps - Issue Types
 * 
 * Issue管理関連の型定義
 */

import { z } from 'zod';

// --------------------------------------------------------
// Issue Status
// --------------------------------------------------------
export const IssueStatusSchema = z.enum([
  'new',
  'triage',
  'in-progress',
  'proposed',
  'merged',
  'rejected',
  'merged-duplicate'
]);

export type IssueStatus = z.infer<typeof IssueStatusSchema>;

// --------------------------------------------------------
// Issue Create/Update DTOs
// --------------------------------------------------------
export const CreateIssueSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  targetFlowId: z.string().optional(),
  targetNodeId: z.string().optional(),
});

export type CreateIssueInput = z.infer<typeof CreateIssueSchema>;

export const UpdateIssueSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  status: IssueStatusSchema.optional(),
});

export type UpdateIssueInput = z.infer<typeof UpdateIssueSchema>;

// --------------------------------------------------------
// Duplicate Merge DTO
// --------------------------------------------------------
export const MergeDuplicateSchema = z.object({
  canonicalId: z.string().min(1), // 統合先のIssue ID
});

export type MergeDuplicateInput = z.infer<typeof MergeDuplicateSchema>;

// --------------------------------------------------------
// Evidence Types
// --------------------------------------------------------
export const EvidenceTypeSchema = z.enum([
  'screenshot',
  'link',
  'text_log'
]);

export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const CreateEvidenceSchema = z.object({
  type: EvidenceTypeSchema,
  url: z.string().min(1),
  note: z.string().optional(),
});

export type CreateEvidenceInput = z.infer<typeof CreateEvidenceSchema>;
