import { describe, expect, it } from 'vitest';
import { AimsReviewerError, createAimsReviewerClient, parseAimsReview } from './reviewer-client';

describe('parseAimsReview', () => {
  it('extracts and validates JSON from a fenced response', () => {
    const output = parseAimsReview('```json\n{"executiveSummary":"ok"}\n```');
    expect(output.schemaVersion).toBe('aims-review.v1');
  });

  it('distinguishes invalid output from transport errors', () => {
    expect(() => parseAimsReview('{"confidence":0.5}')).toThrow(AimsReviewerError);
    try {
      parseAimsReview('{"confidence":0.5}');
    } catch (error) {
      expect((error as AimsReviewerError).code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('development reviewer', () => {
  it('never calls an external provider', async () => {
    const client = createAimsReviewerClient({
      id: 'mock',
      role: 'auditor',
      provider: 'dev-mock',
      model: 'deterministic-mock',
    });
    const output = await client.generate({ system: 'x', user: 'y' });
    expect(output.extensions).toMatchObject({ mock: true, reviewerId: 'mock' });
  });
});
