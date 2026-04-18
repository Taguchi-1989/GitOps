/**
 * FlowOps - Data Object Repository Types
 *
 * GPTsiteki Section 10.5 に準拠したデータオブジェクトのリポジトリ型定義
 */

import type { DataObject, CrossReference } from './schemas';

// --------------------------------------------------------
// DataObject Record (DB永続化後の型)
// --------------------------------------------------------
export interface DataObjectRecord {
  id: string;
  objectId: string;
  parentId: string | null;
  objectType: string;
  sensitivityLevel: string;
  sourceHash: string | null;
  owner: string | null;
  version: string | null;
  accessPolicyRef: string | null;
  contentRef: string | null;
  exportPolicy: string;
  semanticTags: string[] | null;
  provenanceRef: string | null;
  validationRef: string | null;
  validationStatus: string | null;
  fragmentType: string | null;
  semanticObjectType: string | null;
  abstractionMetadata: Record<string, unknown> | null;
  outputArtifactMetadata: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// --------------------------------------------------------
// CrossReference Record
// --------------------------------------------------------
export interface CrossReferenceRecord {
  id: string;
  refId: string;
  sourceObjectId: string;
  targetObjectId: string;
  referenceType: string;
  description: string | null;
  createdAt: Date;
}

// --------------------------------------------------------
// Query Options
// --------------------------------------------------------
export interface DataObjectQueryOptions {
  objectType?: string;
  sensitivityLevel?: string;
  parentId?: string;
  owner?: string;
  validationStatus?: string;
  limit?: number;
  offset?: number;
}

// --------------------------------------------------------
// Repository Interface
// --------------------------------------------------------
export interface IDataObjectRepository {
  create(data: DataObject): Promise<DataObjectRecord>;
  findByObjectId(objectId: string): Promise<DataObjectRecord | null>;
  findMany(options: DataObjectQueryOptions): Promise<DataObjectRecord[]>;
  count(options: DataObjectQueryOptions): Promise<number>;
  update(objectId: string, data: Partial<DataObject>): Promise<DataObjectRecord>;
  delete(objectId: string): Promise<void>;
  findChildren(parentId: string): Promise<DataObjectRecord[]>;

  createCrossReference(ref: CrossReference): Promise<CrossReferenceRecord>;
  findCrossReferences(
    objectId: string,
    direction?: 'source' | 'target' | 'both'
  ): Promise<CrossReferenceRecord[]>;
  deleteCrossReference(refId: string): Promise<void>;
}
