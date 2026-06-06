/**
 * FlowOps - ROI / IRR Decision Model Schema
 *
 * 投資判断（自動化等）の決定論的試算モデル。
 * spec/decision-models/roi-v0.yaml の構造を厳密に型定義する。
 *
 * 重要: このモデルは決定論（LLM不使用）。最終的な投資判断は人が行う。
 */

import { z } from 'zod';
import { TaskMetadataSchema } from '../orchestrator/schemas/micro-task';
import { LifecycleSchema } from '../orchestrator/schemas/lifecycle';

const SEMVER = /^\d+\.\d+\.\d+$/;

// --------------------------------------------------------
// ROI Inputs（スライダー/数値で動かす入力）
// --------------------------------------------------------
export const RoiInputsSchema = z.object({
  // 投資・財務
  investment: z.number().min(0), // 投資額 (円)
  salvageRate: z.number().min(0).max(1), // 残存価額率（投資額比）
  depreciationYears: z.number().int().min(1).max(50), // 償却年数（定額法）
  maintenanceRate: z.number().min(0).max(1), // 年間メンテ費率（投資額比）
  discountRate: z.number().min(0).max(1), // 割引率
  taxRate: z.number().min(0).max(1), // 法人税率
  horizonYears: z.number().int().min(1).max(50), // 評価期間（年）

  // 価値ドライバ（現状 → 改善, 年額）
  laborReduction: z.number(), // 削減人数（人）。負なら増員
  wagePerPersonYear: z.number().min(0), // 人件費（円/人年）
  baselineUnitPrice: z.number().min(0), // 現状単価（円/個）
  improvedUnitPrice: z.number().min(0), // 改善単価（円/個）
  annualVolume: z.number().min(0), // 年間数量（個/年）
  addedValuePerYear: z.number(), // 付加価値（円/年）
  negativeImpactPerYear: z.number().min(0), // 負の差分（円/年, 悪化・人員減損失など）
});

export type RoiInputs = z.infer<typeof RoiInputsSchema>;

// --------------------------------------------------------
// スライダー設定（HTML生成用）
// --------------------------------------------------------
export const RoiSliderSchema = z.object({
  key: z.string().min(1), // RoiInputs のキー
  label: z.string().min(1),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  unit: z.string().optional(),
  group: z.string().optional(), // "finance" | "value" など表示グルーピング
  percent: z.boolean().optional(), // 0-1 を % 表示するか
});

export type RoiSlider = z.infer<typeof RoiSliderSchema>;

// --------------------------------------------------------
// 計算式（LaTeX）
// --------------------------------------------------------
export const RoiFormulaSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  latex: z.string().min(1),
  description: z.string().optional(),
});

export type RoiFormula = z.infer<typeof RoiFormulaSchema>;

// --------------------------------------------------------
// ワークフロー/概念（図示用）
// --------------------------------------------------------
export const RoiWorkflowSchema = z.object({
  title: z.string().optional(),
  steps: z.array(z.string()).default([]), // 概念フローの各ステップ（インラインSVG化）
});

// --------------------------------------------------------
// ROI Model（YAML 正本）
// --------------------------------------------------------
export const RoiModelSchema = z.object({
  id: z.string().min(1),
  version: z.string().regex(SEMVER, 'セマンティックバージョニング形式 (例: 1.0.0)'),
  title: z.string().min(1),
  description: z.string().optional(),

  defaults: RoiInputsSchema,
  sliders: z.array(RoiSliderSchema).default([]),
  formulas: z.array(RoiFormulaSchema).default([]),
  workflow: RoiWorkflowSchema.default({ steps: [] }),

  assumptionRefs: z.array(z.string()).optional(),

  metadata: TaskMetadataSchema,
  lifecycle: LifecycleSchema.optional(),
});

export type RoiModel = z.infer<typeof RoiModelSchema>;

// --------------------------------------------------------
// ROI Result（計算結果）
// --------------------------------------------------------
export interface RoiYearRow {
  year: number; // 0 = 投資年
  benefit: number; // 年間便益
  maintenance: number; // メンテ費
  depreciation: number; // 償却費（非現金）
  taxableIncome: number; // 課税所得
  tax: number; // 税
  netCashflow: number; // 年次キャッシュフロー
  cumulativeCashflow: number; // 累積キャッシュフロー
  discountedCashflow: number; // 割引後キャッシュフロー
}

export interface RoiResult {
  annualBenefit: number; // 年間便益（改善−現状の合計）
  maintenance: number; // 年間メンテ費
  annualDepreciation: number; // 年間償却費（償却期間内）
  annualAccountingProfit: number; // 年間利益（会計, 1年目代表）
  rows: RoiYearRow[]; // 年0..horizon
  roiAnnual: number; // 年次ROI = 年間利益 / 投資額
  roiTotal: number; // 期間ROI = (Σ純CF − 投資額) / 投資額
  npv: number; // 正味現在価値
  irr: number | null; // 内部収益率（解が無ければ null）
  paybackYears: number | null; // 回収年数（達しなければ null）
}
