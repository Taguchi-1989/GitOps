/**
 * FlowOps - Assumption Set Schema
 *
 * spec/assumptions/*.yaml の構造を厳密に型定義する。
 * 前提（assumption）は判断ロジックが成立する条件の正本。
 * 計算式やゲートのしきい値の根拠（出典・理由）をここに集約し、
 * gate / rule は id で参照する。評価時にスナップショットを監査へ残す。
 */

import { z } from 'zod';
import { TaskMetadataSchema } from './micro-task';
import { LifecycleSchema } from './lifecycle';

const SEMVER = /^\d+\.\d+\.\d+$/;

// --------------------------------------------------------
// Single Assumption
// --------------------------------------------------------
export const AssumptionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  source: z.string().optional(), // 出典（規格番号・データセット等）
  rationale: z.string().optional(), // 採用理由
});

export type Assumption = z.infer<typeof AssumptionSchema>;

// --------------------------------------------------------
// Assumption Set (Full)
// --------------------------------------------------------
export const AssumptionSetSchema = z.object({
  id: z.string().min(1),
  version: z.string().regex(SEMVER, 'セマンティックバージョニング形式 (例: 1.0.0)'),
  title: z.string().min(1),
  description: z.string().optional(),

  assumptions: z.array(AssumptionSchema).min(1),

  metadata: TaskMetadataSchema,
  lifecycle: LifecycleSchema.optional(),
});

export type AssumptionSet = z.infer<typeof AssumptionSetSchema>;
