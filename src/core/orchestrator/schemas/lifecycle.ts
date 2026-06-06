/**
 * FlowOps - Pipeline Lifecycle Schema
 *
 * 判断ロジック（タスク/ルール/ゲート/前提）の成熟度ステージ。
 * draft → reviewed → approved → active → deprecated
 *
 * MVP では「土台のみ」: スキーマに optional で持たせ、人が確認したロジック
 * （stage: active）だけを次版に反映する運用を将来 enforce するための器。
 */

import { z } from 'zod';

export const LifecycleStageSchema = z.enum([
  'draft', // 起票・たたき台
  'reviewed', // レビュー済み（未承認）
  'approved', // 承認済み（未適用）
  'active', // 本番適用中
  'deprecated', // 廃止
]);

export type LifecycleStage = z.infer<typeof LifecycleStageSchema>;

export const LifecycleSchema = z.object({
  stage: LifecycleStageSchema.default('draft'),
  reviewedBy: z.string().optional(),
  approvedBy: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Lifecycle = z.infer<typeof LifecycleSchema>;
