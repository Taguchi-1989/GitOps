/**
 * FlowOps - Data Object Model
 *
 * GPTsiteki Sections 10.2-10.8 に準拠したデータオブジェクトのZodスキーマ
 * 企業内データの構造化・意味付け・来歴追跡・抽象化・出力管理を型定義する
 */

import { z } from 'zod';
import { SensitivityLevelSchema, ExportPolicySchema } from '../parser/schema';

// --------------------------------------------------------
// Common patterns
// --------------------------------------------------------
const ObjectIDSchema = z.string().min(1);
const DateTimeSchema = z.string().datetime({ offset: true }); // ISO 8601 (タイムゾーンオフセット付き)

// --------------------------------------------------------
// Section 10.2: Data Object Types (データの単位)
// --------------------------------------------------------
export const DataObjectTypeSchema = z.enum([
  'document', // 文書全体
  'fragment', // ページ、段落、表、図、セル範囲、数式、注記
  'semantic-object', // 設備、配合、条件、材料、手順、結論、制約
  'evidence-link', // 主張と根拠の紐付け
  'transformation-event', // OCR、抽出、変換、要約、検証、承認の処理イベント
]);
export type DataObjectType = z.infer<typeof DataObjectTypeSchema>;

// --------------------------------------------------------
// Section 10.2: Fragment Types (Fragment細分類)
// --------------------------------------------------------
export const FragmentTypeSchema = z.enum([
  'page', // ページ
  'paragraph', // 段落
  'table', // 表
  'figure', // 図
  'cell-range', // セル範囲
  'formula', // 数式
  'annotation', // 注記
]);
export type FragmentType = z.infer<typeof FragmentTypeSchema>;

// --------------------------------------------------------
// Section 10.2: Semantic Object Types (SemanticObject細分類)
// --------------------------------------------------------
export const SemanticObjectTypeSchema = z.enum([
  'equipment', // 設備
  'recipe', // 配合
  'condition', // 条件
  'material', // 材料
  'procedure', // 手順
  'conclusion', // 結論
  'constraint', // 制約
]);
export type SemanticObjectType = z.infer<typeof SemanticObjectTypeSchema>;

// --------------------------------------------------------
// Section 10.2: Transformation Event Types
// --------------------------------------------------------
export const TransformationTypeSchema = z.enum([
  'ocr', // OCR処理
  'extraction', // 構造抽出
  'conversion', // 形式変換
  'summarization', // 要約
  'verification', // 検証
  'approval', // 承認
  'abstraction', // 抽象化処理
]);
export type TransformationType = z.infer<typeof TransformationTypeSchema>;

// --------------------------------------------------------
// Section 10.2: Evidence Link (主張と根拠の紐付け)
// --------------------------------------------------------
export const EvidenceLinkRelationshipSchema = z.enum([
  'supports', // 根拠として支持
  'contradicts', // 矛盾
  'supplements', // 補足
  'derives-from', // 由来
  'references', // 参照
]);
export type EvidenceLinkRelationship = z.infer<typeof EvidenceLinkRelationshipSchema>;

export const EvidenceLinkSchema = z.object({
  id: ObjectIDSchema,
  claimObjectId: ObjectIDSchema, // 主張側オブジェクトID
  evidenceObjectId: ObjectIDSchema, // 根拠側オブジェクトID
  relationshipType: EvidenceLinkRelationshipSchema,
  confidence: z.number().min(0).max(1).optional(), // 信頼度 (0.0-1.0)
  description: z.string().optional(),
  createdAt: DateTimeSchema.optional(),
});
export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;

// --------------------------------------------------------
// Section 10.2: Transformation Event (処理イベント)
// --------------------------------------------------------
export const TransformationEventSchema = z.object({
  id: ObjectIDSchema,
  type: TransformationTypeSchema,
  inputObjectIds: z.array(ObjectIDSchema), // 入力オブジェクトID群
  outputObjectIds: z.array(ObjectIDSchema), // 出力オブジェクトID群
  executedBy: z.string().min(1), // 実行者/システム
  executedAt: DateTimeSchema, // ISO 8601
  parameters: z.record(z.unknown()).optional(), // 処理パラメータ
  confidence: z.number().min(0).max(1).optional(), // 処理結果の信頼度
  metadata: z.record(z.unknown()).optional(),
});
export type TransformationEvent = z.infer<typeof TransformationEventSchema>;

// --------------------------------------------------------
// Section 10.7: Abstraction Policy Type (抽象化ポリシー種別)
// --------------------------------------------------------
export const AbstractionPolicyTypeSchema = z.enum([
  'masking', // マスキング
  'range', // レンジ化
  'binning', // ビン化
  'relative', // 相対化
  'tokenization', // トークン化（固有名称の秘匿）
  'condition-only', // 条件のみ（具体レシピではなく制約条件として表現）
  'result-only', // 結果のみ（入力値秘匿、成立条件のみ）
  'delta-only', // 差分のみ（基準値消去、増減のみ）
]);
export type AbstractionPolicyType = z.infer<typeof AbstractionPolicyTypeSchema>;

// --------------------------------------------------------
// Section 10.7: Re-identification Risk (再識別リスク)
// --------------------------------------------------------
export const ReIdentificationRiskSchema = z.enum([
  'negligible', // 無視可能
  'low', // 低
  'medium', // 中
  'high', // 高
  'critical', // 極めて高い
]);
export type ReIdentificationRisk = z.infer<typeof ReIdentificationRiskSchema>;

// --------------------------------------------------------
// Section 10.7: Abstraction Metadata (抽象化データの持ち方)
// --------------------------------------------------------
export const AbstractionMetadataSchema = z.object({
  abstractionPolicyType: AbstractionPolicyTypeSchema, // 抽象化ポリシー種別
  originalDataRef: ObjectIDSchema, // 元データ参照ID
  reverseReferable: z.boolean().default(false), // 逆引き可否フラグ（GPTsiteki 8.3「通常利用者は逆引きできない」準拠。AccessControlSchemaではデフォルトtrue）
  reIdentificationRisk: ReIdentificationRiskSchema.default('low'), // 再識別リスク評価
  exportAllowed: z.boolean().default(false), // 持出可否
  allowedPurposes: z.array(z.string()).optional(), // 利用可能目的
});
export type AbstractionMetadata = z.infer<typeof AbstractionMetadataSchema>;

// --------------------------------------------------------
// Section 10.8: Output Artifact Metadata (出力との接続)
// --------------------------------------------------------
export const CitationSchema = z.object({
  objectId: ObjectIDSchema,
  label: z.string().optional(),
  location: z.string().optional(), // 出力先での参照箇所
});
export type Citation = z.infer<typeof CitationSchema>;

export const OutputArtifactMetadataSchema = z.object({
  sourceObjectIds: z.array(ObjectIDSchema).min(1), // 参照元オブジェクトID
  generatedAt: DateTimeSchema, // 生成日時 (ISO 8601)
  generatedBy: z.string().min(1), // 生成者/生成システム
  outputLabel: z.string().optional(), // 出力用ラベル
  citations: z.array(CitationSchema).optional(), // 引用元一覧
  regenerable: z.boolean().default(false), // 再生成可否
});
export type OutputArtifactMetadata = z.infer<typeof OutputArtifactMetadataSchema>;

// --------------------------------------------------------
// Section 3.2 / 10.5: Validation Status (検証状態)
// --------------------------------------------------------
export const ValidationStatusSchema = z.enum([
  'unverified', // 未検証
  'machine-verified', // 機械検証済
  'human-verified', // 人手確認済
  'official', // 正式版
]);
export type ValidationStatus = z.infer<typeof ValidationStatusSchema>;

// --------------------------------------------------------
// Section 10.5: Data Object Record (典型レコード構造)
// --------------------------------------------------------

/**
 * DataObject: GPTsiteki Section 10.5 の典型レコード構造
 *
 * データの最小単位（Document / Fragment / SemanticObject）を統一的に表現する
 * "universal envelope" パターン。fragmentType / semanticObjectType は objectType に応じて設定する。
 *
 * 親子関係 (parentId) + 横断参照 (CrossReference) でツリー＋グラフ構造を表現する。
 */
export const DataObjectSchema = z.object({
  // 基本属性
  objectId: ObjectIDSchema,
  parentId: ObjectIDSchema.optional(), // Section 10.6: 親子関係
  objectType: DataObjectTypeSchema,
  sensitivityLevel: SensitivityLevelSchema.default('L1'),
  sourceHash: z.string().optional(), // SHA-256ハッシュ (Section 10.4)
  owner: z.string().optional(), // 所有者
  createdAt: DateTimeSchema, // ISO 8601
  updatedAt: DateTimeSchema, // ISO 8601
  version: z.string().optional(), // バージョン文字列

  // 参照・ポリシー
  accessPolicyRef: z.string().optional(), // アクセスポリシー参照ID
  contentRef: z.string().optional(), // 本文コンテンツ参照URI
  exportPolicy: ExportPolicySchema.default('unrestricted'),

  // 意味・来歴・検証
  semanticTags: z.array(z.string()).optional(), // セマンティックタグ
  provenanceRef: z.string().optional(), // 来歴参照ID
  validationRef: z.string().optional(), // 検証参照ID
  validationStatus: ValidationStatusSchema.optional(),

  // 型別詳細（objectType に応じて設定）
  fragmentType: FragmentTypeSchema.optional(),
  semanticObjectType: SemanticObjectTypeSchema.optional(),

  // Section 10.7: 抽象化情報（抽象化データの場合のみ）
  abstractionMetadata: AbstractionMetadataSchema.optional(),

  // Section 10.8: 出力成果物情報（成果物の場合のみ）
  outputArtifactMetadata: OutputArtifactMetadataSchema.optional(),

  // 拡張用
  meta: z.record(z.unknown()).optional(),
});
export type DataObject = z.infer<typeof DataObjectSchema>;

// --------------------------------------------------------
// Section 10.6: Cross-document Reference (横断参照グラフ)
// --------------------------------------------------------
export const CrossReferenceTypeSchema = z.enum([
  'cites', // 引用
  'derived-from', // 由来
  'related-to', // 関連
  'supersedes', // 更新・置換
  'contradicts', // 矛盾
  'abstracts', // 抽象化元
]);
export type CrossReferenceType = z.infer<typeof CrossReferenceTypeSchema>;

export const CrossReferenceSchema = z.object({
  id: ObjectIDSchema,
  sourceObjectId: ObjectIDSchema,
  targetObjectId: ObjectIDSchema,
  referenceType: CrossReferenceTypeSchema,
  description: z.string().optional(),
  createdAt: DateTimeSchema.optional(),
});
export type CrossReference = z.infer<typeof CrossReferenceSchema>;

// --------------------------------------------------------
// Record-based Maps (ID-indexed access pattern)
// --------------------------------------------------------
export const DataObjectMapSchema = z.record(ObjectIDSchema, DataObjectSchema);
export type DataObjectMap = z.infer<typeof DataObjectMapSchema>;

export const EvidenceLinkMapSchema = z.record(ObjectIDSchema, EvidenceLinkSchema);
export type EvidenceLinkMap = z.infer<typeof EvidenceLinkMapSchema>;

export const TransformationEventMapSchema = z.record(ObjectIDSchema, TransformationEventSchema);
export type TransformationEventMap = z.infer<typeof TransformationEventMapSchema>;

export const CrossReferenceMapSchema = z.record(ObjectIDSchema, CrossReferenceSchema);
export type CrossReferenceMap = z.infer<typeof CrossReferenceMapSchema>;
