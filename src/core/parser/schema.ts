/**
 * FlowOps - Flow Definition Types
 *
 * YAML Flow定義のZodスキーマと型定義
 * Single Source of Truth (SSOT) としてのYAMLを厳密に管理
 */

import { z } from 'zod';

// --------------------------------------------------------
// Basic ID Types
// --------------------------------------------------------
export const FlowIDSchema = z.string().min(1);
export const NodeIDSchema = z.string().min(1);
export const EdgeIDSchema = z.string().min(1);

export type FlowID = z.infer<typeof FlowIDSchema>;
export type NodeID = z.infer<typeof NodeIDSchema>;
export type EdgeID = z.infer<typeof EdgeIDSchema>;

// --------------------------------------------------------
// Flow Layer Definition (フロー抽象度)
// --------------------------------------------------------
export const FlowLayerSchema = z.enum(['L0', 'L1', 'L2']);
export type FlowLayer = z.infer<typeof FlowLayerSchema>;

/**
 * FlowLayer意味定義:
 * - L0: 経営/業務の目的（WHY）と主要成果物
 * - L1: 業務プロセス（WHO/WHAT）
 * - L2: システム手順（HOW：システム入出力、フォーム、API）
 *
 * ※ GPTsiteki機密分類 (L0-L5) とは別概念。機密分類は SensitivityLevelSchema を使用。
 */

// 後方互換エイリアス
export const LayerSchema = FlowLayerSchema;
export type Layer = FlowLayer;

// --------------------------------------------------------
// Sensitivity Level (GPTsiteki 機密分類 L0-L5)
// --------------------------------------------------------
export const SensitivityLevelSchema = z.enum(['L0', 'L1', 'L2', 'L3', 'L4', 'L5']);
export type SensitivityLevel = z.infer<typeof SensitivityLevelSchema>;

/**
 * SensitivityLevel意味定義 (GPTsiteki Section 8.2):
 * - L0: 公開情報
 * - L1: 社内一般
 * - L2: 部門限定
 * - L3: 機密情報
 * - L4: 高機密情報（AI利用時は抽象化必須）
 * - L5: 極秘情報 / 危険パラメータ / 中核ノウハウ（AI利用不可）
 */

// --------------------------------------------------------
// Data Classification (GPTsiteki ノード単位のデータ分類)
// --------------------------------------------------------
export const ExportPolicySchema = z.enum([
  'unrestricted', // 制限なし
  'internal-only', // 社内限定
  'abstracted-only', // 抽象化後のみ
  'prohibited', // 持出禁止
]);
export type ExportPolicy = z.infer<typeof ExportPolicySchema>;

export const DataClassificationSchema = z.object({
  sensitivityLevel: SensitivityLevelSchema.default('L1'),
  aiUsageAllowed: z.boolean().default(true),
  abstractionRequired: z.boolean().default(false),
  exportPolicy: ExportPolicySchema.default('unrestricted'),
});
export type DataClassification = z.infer<typeof DataClassificationSchema>;

// --------------------------------------------------------
// Data Layer (GPTsiteki 3層データアーキテクチャ)
// --------------------------------------------------------
export const DataLayerSchema = z.enum([
  'confidential-original', // 秘匿原本層
  'abstracted-semantic', // 抽象化意味層
  'output-artifact', // 成果物層
]);
export type DataLayer = z.infer<typeof DataLayerSchema>;

// --------------------------------------------------------
// Node Types
// --------------------------------------------------------
export const NodeTypeSchema = z.enum([
  'start',
  'end',
  'process',
  'decision',
  'database',
  'llm-task', // マイクロタスク実行ノード
  'human-review', // Human-in-the-loop承認ノード
]);

export type NodeType = z.infer<typeof NodeTypeSchema>;

// --------------------------------------------------------
// Node Definition
// --------------------------------------------------------
export const NodeSchema = z.object({
  id: NodeIDSchema,
  type: NodeTypeSchema,
  label: z.string().min(1),
  role: z.string().optional(), // roles.yaml のキーと一致すること
  system: z.string().optional(), // systems.yaml のキーと一致すること
  taskId: z.string().optional(), // spec/tasks/{taskId}.yaml への参照
  dataClassification: DataClassificationSchema.optional(), // GPTsiteki: ノード単位のデータ分類
  meta: z.record(z.unknown()).optional(),
});

export type Node = z.infer<typeof NodeSchema>;

// --------------------------------------------------------
// Edge Definition
// --------------------------------------------------------
export const EdgeSchema = z.object({
  id: EdgeIDSchema,
  from: NodeIDSchema,
  to: NodeIDSchema,
  label: z.string().optional(),
  condition: z.string().optional(), // 分岐条件
  dataLayer: DataLayerSchema.optional(), // GPTsiteki: このエッジを流れるデータの層
});

export type Edge = z.infer<typeof EdgeSchema>;

// --------------------------------------------------------
// Flow Definition (Full)
// --------------------------------------------------------
export const FlowSchema = z.object({
  id: FlowIDSchema,
  title: z.string().min(1),
  layer: FlowLayerSchema,
  updatedAt: z.string(), // ISO 8601形式推奨

  // GPTsiteki alignment
  businessPurpose: z.string().optional(), // この業務フローが存在する理由
  ownerOrg: z.string().optional(), // 責任組織
  sensitivityLevel: SensitivityLevelSchema.optional(), // フロー全体のデフォルト機密レベル

  nodes: z.record(NodeIDSchema, NodeSchema), // 【重要】配列ではなくRecord/Map
  edges: z.record(EdgeIDSchema, EdgeSchema), // 【追補A案採用】edgesもRecord
});

export type Flow = z.infer<typeof FlowSchema>;

// --------------------------------------------------------
// Validation Error Types
// --------------------------------------------------------
export const ValidationErrorCodeSchema = z.enum([
  'INVALID_SCHEMA', // Zodスキーマ違反
  'ID_MISMATCH', // flow.idとファイル名不一致
  'DUPLICATE_NODE_ID', // ノードIDの重複
  'MISSING_NODE_REF', // edgeが参照するnodeが存在しない
  'MISSING_START_END', // start/endノードがない
  'UNKNOWN_ROLE', // 辞書にないrole
  'UNKNOWN_SYSTEM', // 辞書にないsystem
]);

export type ValidationErrorCode = z.infer<typeof ValidationErrorCodeSchema>;

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  path?: string;
  details?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// --------------------------------------------------------
// Dictionary Types (for reference validation)
// --------------------------------------------------------
export const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

export const SystemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

export const SensitivityLevelDefinitionSchema = z.object({
  id: SensitivityLevelSchema,
  name: z.string(),
  description: z.string().optional(),
  aiUsageAllowed: z.boolean(),
  abstractionRequired: z.boolean(),
  exportAllowed: z.boolean(),
  auditLevel: z.enum(['minimal', 'standard', 'enhanced', 'strict', 'maximum']).optional(),
});

export type Role = z.infer<typeof RoleSchema>;
export type System = z.infer<typeof SystemSchema>;
export type SensitivityLevelDefinition = z.infer<typeof SensitivityLevelDefinitionSchema>;

export const DictionarySchema = z.object({
  roles: z.record(z.string(), RoleSchema),
  systems: z.record(z.string(), SystemSchema),
  sensitivityLevels: z.record(z.string(), SensitivityLevelDefinitionSchema).optional(),
});

export type Dictionary = z.infer<typeof DictionarySchema>;
