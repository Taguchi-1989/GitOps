/**
 * FlowOps - Micro Task Definition Schema
 *
 * Git管理されるマイクロタスク定義のZodスキーマ
 * spec/tasks/*.yaml の構造を厳密に型定義する
 */

import { z } from 'zod';
import { SensitivityLevelSchema } from '../../parser/schema';

// --------------------------------------------------------
// Task Types
// --------------------------------------------------------
export const TaskTypeSchema = z.enum([
  'llm-inference', // LLM推論タスク
  'data-transform', // データ変換タスク
  'human-review', // 人間によるレビュー
  'api-call', // 外部API呼出
  'conditional', // 条件分岐ロジック
]);

export type TaskType = z.infer<typeof TaskTypeSchema>;

// --------------------------------------------------------
// JSON Schema subset (入出力スキーマ定義用)
// --------------------------------------------------------
const JsonSchemaPropertySchema: z.ZodType<Record<string, unknown>> = z.record(
  z.string(),
  z.unknown()
);

export const JsonSchemaDefinitionSchema = z.object({
  type: z.enum(['object', 'array', 'string', 'number', 'boolean']),
  properties: JsonSchemaPropertySchema.optional(),
  required: z.array(z.string()).optional(),
  items: z.record(z.string(), z.unknown()).optional(),
  enum: z.array(z.unknown()).optional(),
});

// --------------------------------------------------------
// LLM Config
// --------------------------------------------------------
export const LlmConfigSchema = z.object({
  model: z.string().optional(), // LiteLLMモデル名（未指定時はデフォルト）
  systemPrompt: z.string().min(1),
  userPromptTemplate: z.string().min(1), // Mustache形式テンプレート
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(), // 構造化出力用JSON Schema
});

export type LlmConfig = z.infer<typeof LlmConfigSchema>;

// --------------------------------------------------------
// Task Metadata
// --------------------------------------------------------
export const TaskMetadataSchema = z.object({
  author: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

// --------------------------------------------------------
// Micro Task Definition (Full)
// --------------------------------------------------------
export const MicroTaskDefinitionSchema = z.object({
  id: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'セマンティックバージョニング形式 (例: 1.0.0)'),
  type: TaskTypeSchema,

  // LLM固有設定（type: 'llm-inference' の場合に必須）
  llmConfig: LlmConfigSchema.optional(),

  // 入出力契約（マクロ↔ミクロのインターフェース）
  inputSchema: JsonSchemaDefinitionSchema,
  outputSchema: JsonSchemaDefinitionSchema,

  // ガバナンス設定
  requiresHumanApproval: z.boolean().default(false),
  maxRetries: z.number().int().min(0).max(5).default(2),
  timeoutMs: z.number().positive().default(30000),

  // GPTsiteki: データガバナンス設定
  dataGovernance: z
    .object({
      maxSensitivityInput: SensitivityLevelSchema.default('L2'), // 入力データの最大機密レベル
      maxSensitivityOutput: SensitivityLevelSchema.default('L2'), // 出力データの最大機密レベル
      requiresAbstractionPreprocessing: z.boolean().default(false), // LLM投入前に抽象化が必要か
      provenanceTracking: z.boolean().default(true), // 来歴追跡を行うか
    })
    .optional(),

  // メタデータ
  metadata: TaskMetadataSchema,
});

export type MicroTaskDefinition = z.infer<typeof MicroTaskDefinitionSchema>;

// --------------------------------------------------------
// Task Invocation (マクロ→ミクロ呼出)
// --------------------------------------------------------
export const TaskInvocationSchema = z.object({
  traceId: z.string().uuid(),
  executionId: z.string().min(1),
  nodeId: z.string().min(1),
  taskId: z.string().min(1),
  taskVersion: z.string(),
  gitCommitHash: z.string(),
  input: z.record(z.string(), z.unknown()),
  context: z.object({
    flowId: z.string(),
    currentNodeLabel: z.string(),
    previousNodes: z.array(z.string()),
    roles: z.array(z.string()),
    systems: z.array(z.string()),
  }),
});

export type TaskInvocation = z.infer<typeof TaskInvocationSchema>;

// --------------------------------------------------------
// Task Result (ミクロ→マクロ応答)
// --------------------------------------------------------
export const TaskResultSchema = z.object({
  traceId: z.string().uuid(),
  executionId: z.string().min(1),
  taskId: z.string().min(1),
  status: z.enum(['success', 'failure', 'needs-human-review']),
  output: z.record(z.string(), z.unknown()),
  metadata: z.object({
    durationMs: z.number(),
    llmModelUsed: z.string().optional(),
    llmTokensUsed: z
      .object({
        input: z.number(),
        output: z.number(),
      })
      .optional(),
  }),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type TaskResult = z.infer<typeof TaskResultSchema>;
