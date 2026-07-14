import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auditRecord: vi.fn(),
  guardIngress: vi.fn(),
  guardEgress: vi.fn(),
  createRun: vi.fn(),
  createModelReview: vi.fn(),
  completeModelReview: vi.fn(),
  failModelReview: vi.fn(),
  completeRun: vi.fn(),
  failRun: vi.fn(),
}));

vi.mock('@/core/audit', () => ({
  auditLog: { record: mocks.auditRecord },
  hashContent: (value: unknown) => `hash:${JSON.stringify(value).length}`,
  sha256Hex: (value: string) => `sha:${value.length}`,
  stableStringify: (value: unknown) => JSON.stringify(value),
}));

vi.mock('@/core/ingress', () => ({
  guardIngress: mocks.guardIngress,
}));

vi.mock('@/core/egress', () => ({
  guardEgress: mocks.guardEgress,
}));

vi.mock('@/lib/aims-repository', () => ({
  aimsRepository: {
    createRun: mocks.createRun,
    createModelReview: mocks.createModelReview,
    completeModelReview: mocks.completeModelReview,
    failModelReview: mocks.failModelReview,
    completeRun: mocks.completeRun,
    failRun: mocks.failRun,
  },
}));

import { AimsReviewExecutionError, executeAimsReview } from './review-service';

const evidence = {
  id: 'evidence-db-id',
  evidenceId: 'AIMS-EVD-1',
  title: 'Historical record',
  sourceText: 'one line of evidence',
  sourceHash: 'source-hash',
  status: 'imported',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auditRecord.mockResolvedValue({});
  mocks.guardIngress.mockImplementation(async (fields: Record<string, string>) => ({
    fields,
    evaluation: { decision: 'pass' },
    perField: {},
  }));
  mocks.guardEgress.mockResolvedValue({ decision: 'pass' });
  mocks.createRun.mockResolvedValue({ id: 'run-1' });
  mocks.createModelReview.mockImplementation(async ({ config }: { config: { id: string } }) => ({
    id: `model-${config.id}`,
  }));
  mocks.completeModelReview.mockResolvedValue({});
  mocks.failModelReview.mockResolvedValue({});
  mocks.completeRun.mockImplementation(async (input: object) => input);
  mocks.failRun.mockResolvedValue(undefined);
  vi.stubEnv('LLM_PROVIDER', 'dev-mock');
  vi.stubEnv('AIMS_LLM_REVIEWERS', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('executeAimsReview', () => {
  it('stores independent reviews, synthesis, and a completed result', async () => {
    const result = await executeAimsReview({
      evidence,
      request: {},
      actor: 'auditor@example.com',
      traceId: 'trace-1',
    });

    expect(mocks.createModelReview).toHaveBeenCalledTimes(4);
    expect(mocks.completeModelReview).toHaveBeenCalledTimes(4);
    expect(mocks.completeRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', evidenceId: evidence.id })
    );
    expect(result).toMatchObject({ status: 'completed' });
  });

  it('uses deterministic fallback and marks partial when synthesis fails', async () => {
    vi.stubEnv(
      'AIMS_LLM_REVIEWERS',
      JSON.stringify([
        { id: 'review', role: 'auditor', provider: 'dev-mock', model: 'mock' },
        {
          id: 'synthesis',
          role: 'synthesizer',
          provider: 'openai',
          model: 'remote',
          apiKeyEnv: 'MISSING_AIMS_KEY',
        },
      ])
    );
    vi.stubEnv('LLM_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');

    await executeAimsReview({ evidence, request: {}, actor: 'auditor', traceId: 'trace-2' });

    expect(mocks.failModelReview).toHaveBeenCalledTimes(1);
    expect(mocks.completeRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial' }));
  });

  it('fails the run and restores the prior evidence status when every reviewer fails', async () => {
    vi.stubEnv(
      'AIMS_LLM_REVIEWERS',
      JSON.stringify([
        {
          id: 'remote',
          role: 'auditor',
          provider: 'openai',
          model: 'remote',
          apiKeyEnv: 'MISSING_AIMS_KEY',
        },
      ])
    );
    vi.stubEnv('LLM_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');

    await expect(
      executeAimsReview({ evidence, request: {}, actor: 'auditor', traceId: 'trace-3' })
    ).rejects.toBeInstanceOf(AimsReviewExecutionError);
    expect(mocks.failRun).toHaveBeenCalledWith('run-1', evidence.id, evidence.status);
  });
});
