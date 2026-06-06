/**
 * FlowOps - Acceptance Gate Schema
 *
 * spec/gates/*.yaml の構造を厳密に型定義する。
 * ゲートは「あるタスク出力に対して、どのバリデーションルール群を評価し、
 * その結果から次フェーズへ進めてよいか（Go/Revise/Hold/Stop/Watch）を
 * 決定論的に判定する」設定。
 *
 * 重要: ゲートは LLM を使わない。判定は純関数（gate-evaluator）が行い、
 * 最終的な承認/差し戻しは人が Decision Card で決める。
 */

import { z } from 'zod';
import { TaskMetadataSchema } from './micro-task';
import { LifecycleSchema } from './lifecycle';

const SEMVER = /^\d+\.\d+\.\d+$/;

// --------------------------------------------------------
// Gate Outcome
//   go     : 次フェーズへ進めてよい
//   revise : 軽微な是正のうえ再評価
//   hold   : 重大な不足あり、保留
//   stop   : 致命的、機械的に停止（人手前で止める）
//   watch  : 評価対象ルールが無く判断保留（要観察）
// --------------------------------------------------------
export const GateOutcomeSchema = z.enum(['go', 'revise', 'hold', 'stop', 'watch']);

export type GateOutcome = z.infer<typeof GateOutcomeSchema>;

// --------------------------------------------------------
// Gate Policy（severity × passed → outcome の対応表）
// --------------------------------------------------------
export const GatePolicySchema = z.object({
  onCritical: GateOutcomeSchema.default('stop'),
  onError: GateOutcomeSchema.default('hold'),
  onWarning: GateOutcomeSchema.default('revise'),
  allPassed: GateOutcomeSchema.default('go'),
  noRulesMatched: GateOutcomeSchema.default('watch'),
});

export type GatePolicy = z.infer<typeof GatePolicySchema>;

// --------------------------------------------------------
// Gate Definition (Full)
// --------------------------------------------------------
export const GateDefinitionSchema = z.object({
  id: z.string().min(1),
  version: z.string().regex(SEMVER, 'セマンティックバージョニング形式 (例: 1.0.0)'),
  title: z.string().min(1),
  description: z.string().optional(),

  appliesTo: z.object({
    taskId: z.string().min(1),
  }),

  ruleRefs: z.array(z.string()).default([]),
  assumptionRefs: z.array(z.string()).optional(),

  policy: GatePolicySchema,

  metadata: TaskMetadataSchema,
  lifecycle: LifecycleSchema.optional(),
});

export type GateDefinition = z.infer<typeof GateDefinitionSchema>;
