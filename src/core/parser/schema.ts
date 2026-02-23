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
// Node Types
// --------------------------------------------------------
export const NodeTypeSchema = z.enum(['start', 'end', 'process', 'decision', 'database']);

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
});

export type Edge = z.infer<typeof EdgeSchema>;

// --------------------------------------------------------
// Layer Definition
// --------------------------------------------------------
export const LayerSchema = z.enum(['L0', 'L1', 'L2']);
export type Layer = z.infer<typeof LayerSchema>;

/**
 * Layer意味定義:
 * - L0: 経営/業務の目的（WHY）と主要成果物
 * - L1: 業務プロセス（WHO/WHAT）
 * - L2: システム手順（HOW：システム入出力、フォーム、API）
 */

// --------------------------------------------------------
// Flow Definition (Full)
// --------------------------------------------------------
export const FlowSchema = z.object({
  id: FlowIDSchema,
  title: z.string().min(1),
  layer: LayerSchema,
  updatedAt: z.string(), // ISO 8601形式推奨
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

export type Role = z.infer<typeof RoleSchema>;
export type System = z.infer<typeof SystemSchema>;

export const DictionarySchema = z.object({
  roles: z.record(z.string(), RoleSchema),
  systems: z.record(z.string(), SystemSchema),
});

export type Dictionary = z.infer<typeof DictionarySchema>;
