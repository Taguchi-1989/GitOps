import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./prisma', () => ({
  prisma: {
    dataObject: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    crossReference: {
      create: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from './prisma';
import { dataObjectRepository } from './data-object-repository';
import type { DataObject, CrossReference } from '@/core/data/schemas';

const now = new Date();

const sampleDataObject: DataObject = {
  objectId: 'obj-001',
  objectType: 'document',
  sensitivityLevel: 'L2',
  exportPolicy: 'unrestricted',
  createdAt: '2026-03-09T10:00:00+09:00',
  updatedAt: '2026-03-09T10:00:00+09:00',
  owner: 'ProcessTech',
};

const samplePrismaRecord = {
  id: 'cuid-001',
  objectId: 'obj-001',
  parentId: null,
  objectType: 'document',
  sensitivityLevel: 'L2',
  sourceHash: null,
  owner: 'ProcessTech',
  version: null,
  accessPolicyRef: null,
  contentRef: null,
  exportPolicy: 'unrestricted',
  semanticTags: null,
  provenanceRef: null,
  validationRef: null,
  validationStatus: null,
  fragmentType: null,
  semanticObjectType: null,
  abstractionMetadata: null,
  outputArtifactMetadata: null,
  meta: null,
  createdAt: now,
  updatedAt: now,
};

describe('PrismaDataObjectRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create()', () => {
    it('should create a DataObject record', async () => {
      vi.mocked(prisma.dataObject.create).mockResolvedValueOnce(samplePrismaRecord as never);

      const result = await dataObjectRepository.create(sampleDataObject);

      expect(result.objectId).toBe('obj-001');
      expect(result.objectType).toBe('document');
      expect(result.sensitivityLevel).toBe('L2');
      expect(result.owner).toBe('ProcessTech');
      expect(prisma.dataObject.create).toHaveBeenCalledOnce();
    });
  });

  describe('findByObjectId()', () => {
    it('should return a record when found', async () => {
      vi.mocked(prisma.dataObject.findUnique).mockResolvedValueOnce(samplePrismaRecord as never);

      const result = await dataObjectRepository.findByObjectId('obj-001');

      expect(result).not.toBeNull();
      expect(result!.objectId).toBe('obj-001');
      expect(prisma.dataObject.findUnique).toHaveBeenCalledWith({
        where: { objectId: 'obj-001' },
      });
    });

    it('should return null when not found', async () => {
      vi.mocked(prisma.dataObject.findUnique).mockResolvedValueOnce(null as never);

      const result = await dataObjectRepository.findByObjectId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findMany()', () => {
    it('should build conditional WHERE from options', async () => {
      vi.mocked(prisma.dataObject.findMany).mockResolvedValueOnce([samplePrismaRecord] as never);

      const result = await dataObjectRepository.findMany({
        objectType: 'document',
        sensitivityLevel: 'L2',
        owner: 'ProcessTech',
        limit: 10,
        offset: 5,
      });

      expect(result).toHaveLength(1);
      expect(prisma.dataObject.findMany).toHaveBeenCalledWith({
        where: {
          objectType: 'document',
          sensitivityLevel: 'L2',
          owner: 'ProcessTech',
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 5,
      });
    });

    it('should use defaults when options are empty', async () => {
      vi.mocked(prisma.dataObject.findMany).mockResolvedValueOnce([] as never);

      await dataObjectRepository.findMany({});

      expect(prisma.dataObject.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });
  });

  describe('count()', () => {
    it('should count with filters', async () => {
      vi.mocked(prisma.dataObject.count).mockResolvedValueOnce(5 as never);

      const result = await dataObjectRepository.count({
        objectType: 'fragment',
      });

      expect(result).toBe(5);
      expect(prisma.dataObject.count).toHaveBeenCalledWith({
        where: { objectType: 'fragment' },
      });
    });
  });

  describe('update()', () => {
    it('should update specified fields only', async () => {
      const updated = { ...samplePrismaRecord, sensitivityLevel: 'L3' };
      vi.mocked(prisma.dataObject.update).mockResolvedValueOnce(updated as never);

      const result = await dataObjectRepository.update('obj-001', {
        sensitivityLevel: 'L3',
      });

      expect(result.sensitivityLevel).toBe('L3');
      expect(prisma.dataObject.update).toHaveBeenCalledWith({
        where: { objectId: 'obj-001' },
        data: { sensitivityLevel: 'L3' },
      });
    });
  });

  describe('delete()', () => {
    it('should delete by objectId', async () => {
      vi.mocked(prisma.dataObject.delete).mockResolvedValueOnce(samplePrismaRecord as never);

      await dataObjectRepository.delete('obj-001');

      expect(prisma.dataObject.delete).toHaveBeenCalledWith({
        where: { objectId: 'obj-001' },
      });
    });
  });

  describe('findChildren()', () => {
    it('should find children by parentId', async () => {
      const child = { ...samplePrismaRecord, objectId: 'obj-002', parentId: 'obj-001' };
      vi.mocked(prisma.dataObject.findMany).mockResolvedValueOnce([child] as never);

      const result = await dataObjectRepository.findChildren('obj-001');

      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBe('obj-001');
      expect(prisma.dataObject.findMany).toHaveBeenCalledWith({
        where: { parentId: 'obj-001' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('createCrossReference()', () => {
    it('should create a cross reference', async () => {
      const ref: CrossReference = {
        id: 'xref-001',
        sourceObjectId: 'obj-001',
        targetObjectId: 'obj-002',
        referenceType: 'cites',
      };
      const prismaRef = {
        id: 'cuid-xref',
        refId: 'xref-001',
        sourceObjectId: 'obj-001',
        targetObjectId: 'obj-002',
        referenceType: 'cites',
        description: null,
        createdAt: now,
      };
      vi.mocked(prisma.crossReference.create).mockResolvedValueOnce(prismaRef as never);

      const result = await dataObjectRepository.createCrossReference(ref);

      expect(result.refId).toBe('xref-001');
      expect(result.referenceType).toBe('cites');
    });
  });

  describe('findCrossReferences()', () => {
    it('should find references with direction=both', async () => {
      vi.mocked(prisma.crossReference.findMany).mockResolvedValueOnce([] as never);

      await dataObjectRepository.findCrossReferences('obj-001', 'both');

      expect(prisma.crossReference.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ sourceObjectId: 'obj-001' }, { targetObjectId: 'obj-001' }],
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should find references with direction=source', async () => {
      vi.mocked(prisma.crossReference.findMany).mockResolvedValueOnce([] as never);

      await dataObjectRepository.findCrossReferences('obj-001', 'source');

      expect(prisma.crossReference.findMany).toHaveBeenCalledWith({
        where: { sourceObjectId: 'obj-001' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('deleteCrossReference()', () => {
    it('should delete by refId', async () => {
      vi.mocked(prisma.crossReference.delete).mockResolvedValueOnce({} as never);

      await dataObjectRepository.deleteCrossReference('xref-001');

      expect(prisma.crossReference.delete).toHaveBeenCalledWith({
        where: { refId: 'xref-001' },
      });
    });
  });
});
