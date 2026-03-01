/**
 * FlowOps - Workflow Execution Schema
 *
 * ワークフロー実行状態のZodスキーマ
 */

import { z } from 'zod';

// --------------------------------------------------------
// Workflow Execution Status
// --------------------------------------------------------
export const WorkflowStatusSchema = z.enum([
  'running',
  'paused-human-review',
  'completed',
  'failed',
  'cancelled',
]);

export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

// --------------------------------------------------------
// Workflow Execution Request
// --------------------------------------------------------
export const WorkflowExecutionRequestSchema = z.object({
  flowId: z.string().min(1),
  initiatorId: z.string().min(1),
  inputData: z.record(z.unknown()).default({}),
  options: z
    .object({
      dryRun: z.boolean().default(false),
      // タスクバージョンのオーバーライド: taskId -> gitCommitHash
      taskVersionOverrides: z.record(z.string()).optional(),
    })
    .optional(),
});

export type WorkflowExecutionRequest = z.infer<typeof WorkflowExecutionRequestSchema>;

// --------------------------------------------------------
// Node Execution History
// --------------------------------------------------------
export const NodeExecutionRecordSchema = z.object({
  nodeId: z.string(),
  taskId: z.string().optional(),
  taskVersion: z.string().optional(),
  gitCommitHash: z.string().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  input: z.record(z.unknown()),
  output: z.record(z.unknown()).optional(),
  llmModelUsed: z.string().optional(),
  humanDecision: z
    .object({
      approved: z.boolean(),
      reason: z.string().min(1), // ISO 42001: 理由は必須
      decidedBy: z.string(),
      decidedAt: z.string().datetime(),
    })
    .optional(),
});

export type NodeExecutionRecord = z.infer<typeof NodeExecutionRecordSchema>;

// --------------------------------------------------------
// Workflow Execution State (Full)
// --------------------------------------------------------
export const WorkflowExecutionStateSchema = z.object({
  executionId: z.string().min(1),
  flowId: z.string(),
  traceId: z.string().uuid(),
  status: WorkflowStatusSchema,
  currentNodeId: z.string(),
  stateData: z.record(z.unknown()),
  history: z.array(NodeExecutionRecordSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WorkflowExecutionState = z.infer<typeof WorkflowExecutionStateSchema>;

// --------------------------------------------------------
// Approval Decision
// --------------------------------------------------------
export const ApprovalDecisionSchema = z.object({
  approved: z.boolean(),
  reason: z.string().min(1, 'ISO 42001: 承認/否認の理由は必須です'),
  decidedBy: z.string().min(1),
});

export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
