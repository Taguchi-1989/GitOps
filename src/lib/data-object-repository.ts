/**
 * FlowOps - DataObject Repository (Prisma Implementation)
 *
 * PrismaベースのDataObject永続化
 * パターン: src/lib/audit-repository.ts に準拠
 */

import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type {
  IDataObjectRepository,
  DataObjectRecord,
  DataObjectQueryOptions,
  CrossReferenceRecord,
} from '@/core/data/types';
import type { DataObject, CrossReference } from '@/core/data/schemas';

function toRecord(r: Record<string, unknown>): DataObjectRecord {
  return {
    id: r.id as string,
    objectId: r.objectId as string,
    parentId: (r.parentId as string) || null,
    objectType: r.objectType as string,
    sensitivityLevel: r.sensitivityLevel as string,
    sourceHash: (r.sourceHash as string) || null,
    owner: (r.owner as string) || null,
    version: (r.version as string) || null,
    accessPolicyRef: (r.accessPolicyRef as string) || null,
    contentRef: (r.contentRef as string) || null,
    exportPolicy: r.exportPolicy as string,
    semanticTags: r.semanticTags as string[] | null,
    provenanceRef: (r.provenanceRef as string) || null,
    validationRef: (r.validationRef as string) || null,
    validationStatus: (r.validationStatus as string) || null,
    fragmentType: (r.fragmentType as string) || null,
    semanticObjectType: (r.semanticObjectType as string) || null,
    abstractionMetadata: r.abstractionMetadata as Record<string, unknown> | null,
    outputArtifactMetadata: r.outputArtifactMetadata as Record<string, unknown> | null,
    meta: r.meta as Record<string, unknown> | null,
    createdAt: r.createdAt as Date,
    updatedAt: r.updatedAt as Date,
  };
}

function toCrossRefRecord(r: Record<string, unknown>): CrossReferenceRecord {
  return {
    id: r.id as string,
    refId: r.refId as string,
    sourceObjectId: r.sourceObjectId as string,
    targetObjectId: r.targetObjectId as string,
    referenceType: r.referenceType as string,
    description: (r.description as string) || null,
    createdAt: r.createdAt as Date,
  };
}

class PrismaDataObjectRepository implements IDataObjectRepository {
  async create(data: DataObject): Promise<DataObjectRecord> {
    const record = await prisma.dataObject.create({
      data: {
        objectId: data.objectId,
        parentId: data.parentId || null,
        objectType: data.objectType,
        sensitivityLevel: data.sensitivityLevel || 'L1',
        sourceHash: data.sourceHash || null,
        owner: data.owner || null,
        version: data.version || null,
        accessPolicyRef: data.accessPolicyRef || null,
        contentRef: data.contentRef || null,
        exportPolicy: data.exportPolicy || 'unrestricted',
        semanticTags: data.semanticTags ?? Prisma.JsonNull,
        provenanceRef: data.provenanceRef || null,
        validationRef: data.validationRef || null,
        validationStatus: data.validationStatus || null,
        fragmentType: data.fragmentType || null,
        semanticObjectType: data.semanticObjectType || null,
        abstractionMetadata: data.abstractionMetadata
          ? (data.abstractionMetadata as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        outputArtifactMetadata: data.outputArtifactMetadata
          ? (data.outputArtifactMetadata as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        meta: data.meta ? (data.meta as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    return toRecord(record as unknown as Record<string, unknown>);
  }

  async findByObjectId(objectId: string): Promise<DataObjectRecord | null> {
    const record = await prisma.dataObject.findUnique({
      where: { objectId },
    });

    if (!record) return null;
    return toRecord(record as unknown as Record<string, unknown>);
  }

  async findMany(options: DataObjectQueryOptions): Promise<DataObjectRecord[]> {
    const where: Record<string, unknown> = {};

    if (options.objectType) where.objectType = options.objectType;
    if (options.sensitivityLevel) where.sensitivityLevel = options.sensitivityLevel;
    if (options.parentId) where.parentId = options.parentId;
    if (options.owner) where.owner = options.owner;
    if (options.validationStatus) where.validationStatus = options.validationStatus;

    const records = await prisma.dataObject.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return records.map(r => toRecord(r as unknown as Record<string, unknown>));
  }

  async count(options: DataObjectQueryOptions): Promise<number> {
    const where: Record<string, unknown> = {};

    if (options.objectType) where.objectType = options.objectType;
    if (options.sensitivityLevel) where.sensitivityLevel = options.sensitivityLevel;
    if (options.parentId) where.parentId = options.parentId;
    if (options.owner) where.owner = options.owner;
    if (options.validationStatus) where.validationStatus = options.validationStatus;

    return prisma.dataObject.count({ where });
  }

  async update(objectId: string, data: Partial<DataObject>): Promise<DataObjectRecord> {
    const updateData: Record<string, unknown> = {};

    if (data.parentId !== undefined) updateData.parentId = data.parentId || null;
    if (data.objectType !== undefined) updateData.objectType = data.objectType;
    if (data.sensitivityLevel !== undefined) updateData.sensitivityLevel = data.sensitivityLevel;
    if (data.sourceHash !== undefined) updateData.sourceHash = data.sourceHash || null;
    if (data.owner !== undefined) updateData.owner = data.owner || null;
    if (data.version !== undefined) updateData.version = data.version || null;
    if (data.accessPolicyRef !== undefined)
      updateData.accessPolicyRef = data.accessPolicyRef || null;
    if (data.contentRef !== undefined) updateData.contentRef = data.contentRef || null;
    if (data.exportPolicy !== undefined) updateData.exportPolicy = data.exportPolicy;
    if (data.semanticTags !== undefined) updateData.semanticTags = data.semanticTags || null;
    if (data.provenanceRef !== undefined) updateData.provenanceRef = data.provenanceRef || null;
    if (data.validationRef !== undefined) updateData.validationRef = data.validationRef || null;
    if (data.validationStatus !== undefined)
      updateData.validationStatus = data.validationStatus || null;
    if (data.fragmentType !== undefined) updateData.fragmentType = data.fragmentType || null;
    if (data.semanticObjectType !== undefined)
      updateData.semanticObjectType = data.semanticObjectType || null;
    if (data.abstractionMetadata !== undefined) {
      updateData.abstractionMetadata = data.abstractionMetadata
        ? (data.abstractionMetadata as Record<string, unknown>)
        : null;
    }
    if (data.outputArtifactMetadata !== undefined) {
      updateData.outputArtifactMetadata = data.outputArtifactMetadata
        ? (data.outputArtifactMetadata as Record<string, unknown>)
        : null;
    }
    if (data.meta !== undefined) updateData.meta = data.meta || null;

    const record = await prisma.dataObject.update({
      where: { objectId },
      data: updateData,
    });

    return toRecord(record as unknown as Record<string, unknown>);
  }

  async delete(objectId: string): Promise<void> {
    await prisma.dataObject.delete({
      where: { objectId },
    });
  }

  async findChildren(parentId: string): Promise<DataObjectRecord[]> {
    const records = await prisma.dataObject.findMany({
      where: { parentId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(r => toRecord(r as unknown as Record<string, unknown>));
  }

  async createCrossReference(ref: CrossReference): Promise<CrossReferenceRecord> {
    const record = await prisma.crossReference.create({
      data: {
        refId: ref.id,
        sourceObjectId: ref.sourceObjectId,
        targetObjectId: ref.targetObjectId,
        referenceType: ref.referenceType,
        description: ref.description || null,
      },
    });

    return toCrossRefRecord(record as unknown as Record<string, unknown>);
  }

  async findCrossReferences(
    objectId: string,
    direction: 'source' | 'target' | 'both' = 'both'
  ): Promise<CrossReferenceRecord[]> {
    const where: Record<string, unknown> = {};

    if (direction === 'source') {
      where.sourceObjectId = objectId;
    } else if (direction === 'target') {
      where.targetObjectId = objectId;
    } else {
      where.OR = [{ sourceObjectId: objectId }, { targetObjectId: objectId }];
    }

    const records = await prisma.crossReference.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return records.map(r => toCrossRefRecord(r as unknown as Record<string, unknown>));
  }

  async deleteCrossReference(refId: string): Promise<void> {
    await prisma.crossReference.delete({
      where: { refId },
    });
  }
}

export const dataObjectRepository = new PrismaDataObjectRepository();
