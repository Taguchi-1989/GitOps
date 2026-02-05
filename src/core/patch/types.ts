/**
 * FlowOps - Proposal/Patch Types
 * 
 * LLM提案とJSON Patch関連の型定義
 */

import { z } from 'zod';

// --------------------------------------------------------
// JSON Patch Operations
// --------------------------------------------------------
export const JsonPatchOpSchema = z.enum([
  'add',
  'remove',
  'replace',
  'move',
  'copy',
  'test'
]);

export type JsonPatchOp = z.infer<typeof JsonPatchOpSchema>;

export const JsonPatchSchema = z.object({
  op: JsonPatchOpSchema,
  path: z.string().min(1),
  value: z.any().optional(),
  from: z.string().optional(), // for move/copy operations
});

export type JsonPatch = z.infer<typeof JsonPatchSchema>;

// --------------------------------------------------------
// LLM Proposal Output Schema
// --------------------------------------------------------
export const ProposalOutputSchema = z.object({
  intent: z.string().min(1),         // 変更意図の要約
  patches: z.array(JsonPatchSchema), // 変更差分
});

export type ProposalOutput = z.infer<typeof ProposalOutputSchema>;

// --------------------------------------------------------
// Proposal with metadata
// --------------------------------------------------------
export const ProposalWithMetadataSchema = ProposalOutputSchema.extend({
  baseHash: z.string(),       // 対象YAMLのハッシュ
  targetFlowId: z.string(),   // 対象フローID
});

export type ProposalWithMetadata = z.infer<typeof ProposalWithMetadataSchema>;

// --------------------------------------------------------
// Proposal Error Codes
// --------------------------------------------------------
export const ProposalErrorCodeSchema = z.enum([
  'INVALID_OUTPUT',      // LLM出力がスキーマ違反
  'STALE_PROPOSAL',      // baseHash不一致（再生成必要）
  'FORBIDDEN_PATH',      // 禁止されたパスへの変更
  'UNKNOWN_ROLE',        // 辞書にないroleを使用
  'UNKNOWN_SYSTEM',      // 辞書にないsystemを使用
  'PATCH_APPLY_FAILED',  // パッチ適用失敗
]);

export type ProposalErrorCode = z.infer<typeof ProposalErrorCodeSchema>;

// --------------------------------------------------------
// Apply Proposal Result
// --------------------------------------------------------
export interface ApplyProposalResult {
  success: boolean;
  errorCode?: ProposalErrorCode;
  message?: string;
  appliedPatches?: number;
  commitHash?: string;
}
