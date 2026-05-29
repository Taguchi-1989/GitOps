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

const sampleAbstractionMetadata = {
  abstractionPolicyType: 'masking' as const,
  originalDataRef: 'obj-original',
  reverseReferable: false,
  reIdentificationRisk: 'low' as const,
  exportAllowed: false,
};

const sampleOutputArtifactMetadata = {
  sourceObjectIds: ['obj-src'],
  generatedAt: '2026-03-09T10:00:00+09:00',
  generatedBy: 'system',
  regenerable: false,
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

  describe('create()', () => {
    it('serializes JSON fields and passes all optional fields when fully populated', async () => {
      const fullObject: DataObject = {
        ...sampleDataObject,
        parentId: 'parent-1',
        sourceHash: 'hash-1',
        version: 'v2',
        accessPolicyRef: 'policy-1',
        contentRef: 'content-1',
        semanticTags: ['tag-a', 'tag-b'],
        provenanceRef: 'prov-1',
        validationRef: 'val-1',
        validationStatus: 'machine-verified',
        fragmentType: 'paragraph',
        semanticObjectType: 'procedure',
        abstractionMetadata: sampleAbstractionMetadata,
        outputArtifactMetadata: sampleOutputArtifactMetadata,
        meta: { note: 'hello' },
      };
      vi.mocked(prisma.dataObject.create).mockResolvedValueOnce(samplePrismaRecord as never);

      await dataObjectRepository.create(fullObject);

      const arg = vi.mocked(prisma.dataObject.create).mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(arg.data.parentId).toBe('parent-1');
      expect(arg.data.semanticTags).toBe(JSON.stringify(['tag-a', 'tag-b']));
      expect(arg.data.abstractionMetadata).toBe(JSON.stringify(sampleAbstractionMetadata));
      expect(arg.data.outputArtifactMetadata).toBe(JSON.stringify(sampleOutputArtifactMetadata));
      expect(arg.data.meta).toBe(JSON.stringify({ note: 'hello' }));
    });
  });

  describe('toRecord() JSON parsing', () => {
    it('parses stringified JSON fields and arrays from the DB record', async () => {
      const record = {
        ...samplePrismaRecord,
        parentId: 'parent-9',
        sourceHash: 'h',
        version: 'v1',
        accessPolicyRef: 'ap',
        contentRef: 'cr',
        semanticTags: JSON.stringify(['x', 'y']),
        provenanceRef: 'pr',
        validationRef: 'vr',
        validationStatus: 'validated',
        fragmentType: 'ft',
        semanticObjectType: 'sot',
        abstractionMetadata: JSON.stringify({ a: 1 }),
        outputArtifactMetadata: JSON.stringify({ b: 2 }),
        meta: JSON.stringify({ c: 3 }),
      };
      vi.mocked(prisma.dataObject.findUnique).mockResolvedValueOnce(record as never);

      const result = await dataObjectRepository.findByObjectId('obj-001');

      expect(result!.semanticTags).toEqual(['x', 'y']);
      expect(result!.abstractionMetadata).toEqual({ a: 1 });
      expect(result!.outputArtifactMetadata).toEqual({ b: 2 });
      expect(result!.meta).toEqual({ c: 3 });
      expect(result!.parentId).toBe('parent-9');
    });

    it('returns null for malformed JSON strings instead of throwing', async () => {
      const record = {
        ...samplePrismaRecord,
        semanticTags: 'not-json',
        meta: '{broken',
      };
      vi.mocked(prisma.dataObject.findUnique).mockResolvedValueOnce(record as never);

      const result = await dataObjectRepository.findByObjectId('obj-001');

      expect(result!.semanticTags).toBeNull();
      expect(result!.meta).toBeNull();
    });

    it('passes through already-parsed object/array JSON fields', async () => {
      const record = {
        ...samplePrismaRecord,
        semanticTags: ['already', 'array'],
        meta: { already: 'object' },
      };
      vi.mocked(prisma.dataObject.findUnique).mockResolvedValueOnce(record as never);

      const result = await dataObjectRepository.findByObjectId('obj-001');

      expect(result!.semanticTags).toEqual(['already', 'array']);
      expect(result!.meta).toEqual({ already: 'object' });
    });
  });

  describe('count()', () => {
    it('includes parentId and validationStatus filters', async () => {
      vi.mocked(prisma.dataObject.count).mockResolvedValueOnce(2 as never);

      await dataObjectRepository.count({ parentId: 'p1', validationStatus: 'validated' });

      expect(prisma.dataObject.count).toHaveBeenCalledWith({
        where: { parentId: 'p1', validationStatus: 'validated' },
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

    it('maps every provided field into the update payload', async () => {
      vi.mocked(prisma.dataObject.update).mockResolvedValueOnce(samplePrismaRecord as never);

      await dataObjectRepository.update('obj-001', {
        parentId: 'p2',
        objectType: 'fragment',
        sensitivityLevel: 'L4',
        sourceHash: 'sh',
        owner: 'o',
        version: 'v3',
        accessPolicyRef: 'ap',
        contentRef: 'cr',
        exportPolicy: 'internal-only',
        semanticTags: ['t1'],
        provenanceRef: 'pr',
        validationRef: 'vr',
        validationStatus: 'machine-verified',
        fragmentType: 'paragraph',
        semanticObjectType: 'procedure',
        abstractionMetadata: sampleAbstractionMetadata,
        outputArtifactMetadata: sampleOutputArtifactMetadata,
        meta: { c: 3 },
      });

      const arg = vi.mocked(prisma.dataObject.update).mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(arg.data).toMatchObject({
        parentId: 'p2',
        objectType: 'fragment',
        sensitivityLevel: 'L4',
        exportPolicy: 'internal-only',
        validationStatus: 'machine-verified',
        semanticObjectType: 'procedure',
      });
      expect(arg.data.abstractionMetadata).toEqual(sampleAbstractionMetadata);
      expect(arg.data.outputArtifactMetadata).toEqual(sampleOutputArtifactMetadata);
    });

    it('nullifies falsy optional fields on update', async () => {
      vi.mocked(prisma.dataObject.update).mockResolvedValueOnce(samplePrismaRecord as never);

      await dataObjectRepository.update('obj-001', {
        parentId: '',
        sourceHash: '',
        owner: '',
        semanticTags: null as never,
        abstractionMetadata: null as never,
        outputArtifactMetadata: null as never,
        meta: null as never,
      });

      const arg = vi.mocked(prisma.dataObject.update).mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(arg.data.parentId).toBeNull();
      expect(arg.data.sourceHash).toBeNull();
      expect(arg.data.owner).toBeNull();
      expect(arg.data.abstractionMetadata).toBeNull();
      expect(arg.data.outputArtifactMetadata).toBeNull();
      expect(arg.data.meta).toBeNull();
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

    it('should find references with direction=target', async () => {
      vi.mocked(prisma.crossReference.findMany).mockResolvedValueOnce([] as never);

      await dataObjectRepository.findCrossReferences('obj-001', 'target');

      expect(prisma.crossReference.findMany).toHaveBeenCalledWith({
        where: { targetObjectId: 'obj-001' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should default to direction=both when not specified', async () => {
      vi.mocked(prisma.crossReference.findMany).mockResolvedValueOnce([] as never);

      await dataObjectRepository.findCrossReferences('obj-001');

      expect(prisma.crossReference.findMany).toHaveBeenCalledWith({
        where: { OR: [{ sourceObjectId: 'obj-001' }, { targetObjectId: 'obj-001' }] },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('maps cross reference records including the description field', async () => {
      const prismaRef = {
        id: 'cuid-x',
        refId: 'xref-9',
        sourceObjectId: 'obj-001',
        targetObjectId: 'obj-002',
        referenceType: 'derives',
        description: 'derived from',
        createdAt: now,
      };
      vi.mocked(prisma.crossReference.findMany).mockResolvedValueOnce([prismaRef] as never);

      const result = await dataObjectRepository.findCrossReferences('obj-001', 'source');

      expect(result[0].description).toBe('derived from');
      expect(result[0].refId).toBe('xref-9');
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
