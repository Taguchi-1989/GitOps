import { describe, expect, it } from 'vitest';
import {
  AimsHumanDecisionSchema,
  AimsReviewOutputSchema,
  AimsReviewerConfigSchema,
  CreateAimsEvidenceSchema,
  StartAimsReviewSchema,
} from './types';

describe('AIMS input schemas', () => {
  it('normalizes evidence defaults', () => {
    const value = CreateAimsEvidenceSchema.parse({ title: ' Legacy log ', sourceText: 'record' });
    expect(value).toMatchObject({
      title: 'Legacy log',
      sourceType: 'historical-text',
      sensitivityLevel: 'L2',
      tags: [],
      metadata: {},
    });
  });

  it('limits evidence source text', () => {
    expect(() =>
      CreateAimsEvidenceSchema.parse({ title: 'x', sourceText: 'x'.repeat(500_001) })
    ).toThrow();
  });

  it('requires a human decision reason', () => {
    expect(AimsHumanDecisionSchema.safeParse({ decision: 'approved', reason: '' }).success).toBe(
      false
    );
  });

  it('accepts a bounded reviewer selection', () => {
    expect(StartAimsReviewSchema.parse({ reviewerIds: ['summary'] }).reviewerIds).toEqual([
      'summary',
    ]);
  });
});

describe('AIMS output and reviewer schemas', () => {
  it('fills the extensible review defaults', () => {
    const output = AimsReviewOutputSchema.parse({ executiveSummary: 'Summary' });
    expect(output.schemaVersion).toBe('aims-review.v1');
    expect(output.findings).toEqual([]);
    expect(output.humanDecisionRequired).toBe(true);
    expect(output.extensions).toEqual({});
  });

  it('rejects confidence outside the valid range', () => {
    expect(
      AimsReviewOutputSchema.safeParse({ executiveSummary: 'Summary', confidence: 1.1 }).success
    ).toBe(false);
  });

  it('does not permit inline API keys in reviewer configuration', () => {
    expect(
      AimsReviewerConfigSchema.safeParse({
        id: 'reviewer',
        role: 'auditor',
        provider: 'openai',
        model: 'model',
        apiKey: 'secret',
      }).success
    ).toBe(false);
  });
});
