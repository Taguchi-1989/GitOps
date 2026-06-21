/**
 * FlowOps - Ingress Gate Types (ガバナンス・ハーネス §4.1 入口ゲート)
 *
 * 外部送出（LLM API 呼び出し）前に、入力中の機密を決定論的に検査するための型。
 * - 結合型(combination): 識別子と属性の結合が秘密 → マスキングで素通し可
 * - 値型(value): 値そのものが秘密（資格情報・鍵等） → 検出時点で block + 人間承認
 * - 判定不能(確信度しきい値未満) → fail-safe で block（POL-3 / ING-2）
 *
 * 本モジュールは LLM を一切呼ばない（ING-3）。純粋な決定論ロジックのみ。
 */

import { z } from 'zod';

// --------------------------------------------------------
// 機密性タイプ（spec §3.3）
// --------------------------------------------------------
export const SecretKindSchema = z.enum(['combination', 'value']);
export type SecretKind = z.infer<typeof SecretKindSchema>;

// --------------------------------------------------------
// 検出パターン（ポリシーが宣言的に保持）
// --------------------------------------------------------
export const IngressPatternSchema = z.object({
  id: z.string().min(1),
  kind: SecretKindSchema,
  description: z.string().default(''),
  // 決定論検出器。正規表現ソース文字列で保持（Presidio 相当のローカル決定論検出）
  regex: z.string().min(1),
  // 大文字小文字無視など。'g'(global) は走査側で常に付与するため不要
  flags: z.string().default(''),
  // 検出確信度 0..1。confidenceThreshold 未満は「判定不能」として安全側へ倒す
  confidence: z.number().min(0).max(1).default(0.9),
});
export type IngressPattern = z.infer<typeof IngressPatternSchema>;

// --------------------------------------------------------
// 入口ゲート・ポリシー（バージョン付き単一真実源 / POL-1, POL-2）
// --------------------------------------------------------
export const IngressPolicySchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  title: z.string().default(''),
  // ING-2: この確信度未満の検出は「判定不能」扱い → fail-safe
  confidenceThreshold: z.number().min(0).max(1).default(0.5),
  // POL-3: 判定不能・値型検出時の既定動作。安全側のみ許容（block 固定）
  failSafe: z.literal('block').default('block'),
  patterns: z.array(IngressPatternSchema).default([]),
});
export type IngressPolicy = z.infer<typeof IngressPolicySchema>;

// --------------------------------------------------------
// 検出結果（実体は載せない。位置・パターンid・種別のみ）
// --------------------------------------------------------
export type DetectionClass = 'combination' | 'value' | 'uncertain';

export interface IngressDetection {
  patternId: string;
  /** 分類後の扱い: combination=マスク可 / value=block / uncertain=fail-safe block */
  classification: DetectionClass;
  kind: SecretKind;
  confidence: number;
  /** 一致の出現回数（実体文字列は保持しない） */
  count: number;
}

export type IngressDecision = 'pass' | 'mask' | 'block';

// 監査の重大度層（§6.2）へ写す: value=full(違反検出) / uncertain=thick(エスカレ) / それ以外=thin
export type IngressTier = 'thin' | 'thick' | 'full';

export interface IngressEvaluation {
  policyId: string;
  policyVersion: string;
  decision: IngressDecision;
  tier: IngressTier;
  detections: IngressDetection[];
  /** decision==='mask' のとき、結合型を伏字化した安全テキスト。block/pass では元テキストと同一 */
  maskedText: string;
  /** マスクで置換した件数 */
  maskedCount: number;
}
