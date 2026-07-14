import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, prismaMock } = vi.hoisted(() => {
  const functions = {
    evidenceCreate: vi.fn(),
    evidenceFindFirst: vi.fn(),
    evidenceFindMany: vi.fn(),
    evidenceCount: vi.fn(),
    evidenceUpdate: vi.fn(),
    runCreate: vi.fn(),
    runUpdate: vi.fn(),
    runFindFirst: vi.fn(),
    runFindUnique: vi.fn(),
    modelCreate: vi.fn(),
    modelUpdate: vi.fn(),
    transaction: vi.fn(),
  };
  return {
    db: functions,
    prismaMock: {
      aimsEvidence: {
        create: functions.evidenceCreate,
        findFirst: functions.evidenceFindFirst,
        findMany: functions.evidenceFindMany,
        count: functions.evidenceCount,
        update: functions.evidenceUpdate,
      },
      aimsReviewRun: {
        create: functions.runCreate,
        update: functions.runUpdate,
        findFirst: functions.runFindFirst,
        findUnique: functions.runFindUnique,
      },
      aimsModelReview: {
        create: functions.modelCreate,
        update: functions.modelUpdate,
      },
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: { ...prismaMock, $transaction: db.transaction } }));

import { AimsDecisionConflictError, aimsRepository, serializeAimsRecord } from './aims-repository';

const reviewer = {
  id: 'audit',
  role: 'auditor' as const,
  provider: 'dev-mock',
  model: 'mock',
};

beforeEach(() => {
  vi.clearAllMocks();
  db.transaction.mockImplementation(async input => {
    if (typeof input === 'function') return input(prismaMock);
    return Promise.all(input);
  });
  db.evidenceUpdate.mockResolvedValue({});
  db.runUpdate.mockResolvedValue({ id: 'run' });
  db.modelUpdate.mockResolvedValue({ id: 'model' });
});

describe('aimsRepository evidence', () => {
  it('creates canonical evidence with JSON metadata and an occurrence date', async () => {
    db.evidenceCreate.mockResolvedValue({ id: 'db-evidence' });
    await aimsRepository.createEvidence({
      evidenceId: 'AIMS-EVD-1',
      title: 'Record',
      sourceText: 'source',
      sourceHash: 'hash',
      sourceType: 'historical-text',
      sensitivityLevel: 'L2',
      occurredAt: '2026-07-01T00:00:00Z',
      tags: ['audit'],
      metadata: { owner: 'team' },
      collectedBy: 'person',
    });
    expect(db.evidenceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evidenceId: 'AIMS-EVD-1',
        tagsJson: '["audit"]',
        metadataJson: '{"owner":"team"}',
        occurredAt: new Date('2026-07-01T00:00:00Z'),
      }),
    });
  });

  it('finds evidence by database or business id', async () => {
    db.evidenceFindFirst.mockResolvedValue({ id: 'record' });
    await expect(aimsRepository.findEvidence('lookup')).resolves.toEqual({ id: 'record' });
    expect(db.evidenceFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ id: 'lookup' }, { evidenceId: 'lookup' }] } })
    );
  });

  it('lists evidence and total in parallel', async () => {
    db.evidenceFindMany.mockResolvedValue([{ id: 'one' }]);
    db.evidenceCount.mockResolvedValue(3);
    await expect(
      aimsRepository.listEvidence({ limit: 10, offset: 5, status: 'reviewed' })
    ).resolves.toEqual({ records: [{ id: 'one' }], total: 3 });
    expect(db.evidenceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'reviewed' }, take: 10, skip: 5 })
    );
  });
});

describe('aimsRepository run lifecycle', () => {
  it('creates a run and marks evidence under review transactionally', async () => {
    db.runCreate.mockResolvedValue({ id: 'run' });
    await aimsRepository.createRun({
      evidenceId: 'evidence',
      traceId: 'trace',
      reviewers: [reviewer],
      synthesizer: { ...reviewer, id: 'synth', role: 'synthesizer' },
      initiatedBy: 'person',
      policyVersion: '1.0.0',
    });
    expect(db.runCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ strategy: 'independent-then-synthesis' }),
    });
    expect(db.evidenceUpdate).toHaveBeenCalledWith({
      where: { id: 'evidence' },
      data: { status: 'under-review' },
    });
  });

  it('creates, completes, and fails model reviews', async () => {
    db.modelCreate.mockResolvedValue({ id: 'model' });
    await aimsRepository.createModelReview({ runId: 'run', config: reviewer, promptVersion: '1' });
    await aimsRepository.completeModelReview('model', {
      status: 'success',
      inputHash: 'input',
      outputJson: '{}',
      chunkOutputsJson: '[]',
      outputHash: 'output',
      chunkCount: 1,
      durationMs: 5,
    });
    await aimsRepository.failModelReview('model', {
      chunkCount: 1,
      durationMs: 6,
      error: 'failure',
    });
    expect(db.modelCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ reviewerId: 'audit', status: 'running' }),
    });
    expect(db.modelUpdate).toHaveBeenCalledTimes(2);
  });

  it('completes a run and marks evidence reviewed', async () => {
    await aimsRepository.completeRun({
      runId: 'run',
      evidenceId: 'evidence',
      status: 'partial',
      finalOutputJson: '{}',
      finalOutputHash: 'hash',
    });
    expect(db.runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'partial' }) })
    );
    expect(db.evidenceUpdate).toHaveBeenCalledWith({
      where: { id: 'evidence' },
      data: { status: 'reviewed' },
    });
  });

  it('fails a run while restoring the previous evidence state', async () => {
    await aimsRepository.failRun('run', 'evidence', 'approved');
    expect(db.transaction).toHaveBeenCalled();
    expect(db.evidenceUpdate).toHaveBeenCalledWith({
      where: { id: 'evidence' },
      data: { status: 'approved' },
    });
  });

  it('finds a run by id or trace id', async () => {
    db.runFindFirst.mockResolvedValue({ id: 'run' });
    await aimsRepository.findRun('lookup');
    expect(db.runFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ id: 'lookup' }, { traceId: 'lookup' }] } })
    );
  });
});

describe('aimsRepository human decision', () => {
  it('records one decision and updates evidence status', async () => {
    db.runFindUnique.mockResolvedValue({
      id: 'run',
      evidenceId: 'evidence',
      status: 'completed',
      humanDecision: null,
    });
    db.runUpdate.mockResolvedValue({ id: 'run', humanDecision: 'approved' });
    await expect(
      aimsRepository.recordDecision(
        'run',
        { decision: 'approved', reason: 'Evidence is sufficient' },
        'approver'
      )
    ).resolves.toMatchObject({ humanDecision: 'approved' });
    expect(db.evidenceUpdate).toHaveBeenCalledWith({
      where: { id: 'evidence' },
      data: { status: 'approved' },
    });
  });

  it('returns null when the run does not exist', async () => {
    db.runFindUnique.mockResolvedValue(null);
    await expect(
      aimsRepository.recordDecision('missing', { decision: 'rejected', reason: 'No' }, 'person')
    ).resolves.toBeNull();
  });

  it('rejects an unfinished or already decided run', async () => {
    db.runFindUnique.mockResolvedValue({ status: 'running', humanDecision: null });
    await expect(
      aimsRepository.recordDecision('run', { decision: 'revise', reason: 'Wait' }, 'person')
    ).rejects.toBeInstanceOf(AimsDecisionConflictError);

    db.runFindUnique.mockResolvedValue({ status: 'completed', humanDecision: 'approved' });
    await expect(
      aimsRepository.recordDecision('run', { decision: 'revise', reason: 'Again' }, 'person')
    ).rejects.toThrow('already been recorded');
  });
});

describe('serializeAimsRecord', () => {
  it('decodes JSON suffixes recursively and preserves dates', () => {
    const date = new Date('2026-07-14T00:00:00Z');
    expect(
      serializeAimsRecord({
        tagsJson: '["one"]',
        finalOutputJson: '{"summary":"ok"}',
        brokenJson: '{',
        createdAt: date,
        nested: [{ metadataJson: '{"x":1}' }],
      })
    ).toEqual({
      tags: ['one'],
      finalOutput: { summary: 'ok' },
      broken: '{',
      createdAt: date,
      nested: [{ metadata: { x: 1 } }],
    });
  });
});
