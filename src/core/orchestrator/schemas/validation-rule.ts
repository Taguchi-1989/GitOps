/**
 * FlowOps - Validation Rule Schema
 *
 * spec/validation-rules/*.yaml の構造を厳密に型定義する。
 * バリデーションルールは「タスク出力が満たすべき決定論的な条件」であり、
 * Acceptance Gate がこれらを評価して Go/Revise/Hold/Stop/Watch を決める。
 */

import { z } from 'zod';
import { TaskMetadataSchema } from './micro-task';
import { LifecycleSchema } from './lifecycle';

const SEMVER = /^\d+\.\d+\.\d+$/;

// --------------------------------------------------------
// Rule Type / Severity
// --------------------------------------------------------
export const RuleTypeSchema = z.enum([
  'completeness', // 必須項目/カテゴリの網羅性（MVP実装）
  'compliance', // 規格・ポリシー適合（拡張余地）
  'threshold', // 数値しきい値（拡張余地）
  'consistency', // 相互整合性（拡張余地）
]);

export type RuleType = z.infer<typeof RuleTypeSchema>;

export const RuleSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);

export type RuleSeverity = z.infer<typeof RuleSeveritySchema>;

// --------------------------------------------------------
// Rule Logic
//   field: 評価対象のフィールドパス（例: "hazards[].category"）
//   passthrough で ruleType ごとの追加キーを落とさない
// --------------------------------------------------------
export const RuleLogicSchema = z
  .object({
    field: z.string().min(1),
    requiredCategories: z.array(z.string()).optional(),
    minimumCoverage: z.number().min(0).max(1).optional(),
  })
  .passthrough();

export type RuleLogic = z.infer<typeof RuleLogicSchema>;

// --------------------------------------------------------
// Rule Definition (Full)
// --------------------------------------------------------
export const RuleDefinitionSchema = z.object({
  id: z.string().min(1),
  version: z.string().regex(SEMVER, 'セマンティックバージョニング形式 (例: 1.0.0)'),
  title: z.string().min(1),
  description: z.string().optional(),

  ruleType: RuleTypeSchema,
  severity: RuleSeveritySchema,

  appliesTo: z.object({
    taskId: z.string().min(1),
    outputField: z.string().min(1),
  }),

  ruleLogic: RuleLogicSchema,

  metadata: TaskMetadataSchema,
  lifecycle: LifecycleSchema.optional(),
});

export type RuleDefinition = z.infer<typeof RuleDefinitionSchema>;
