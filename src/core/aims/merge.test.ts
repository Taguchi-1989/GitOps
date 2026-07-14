import { describe, expect, it } from 'vitest';
import { mergeAimsReviewOutputs } from './merge';
import { AimsReviewOutputSchema } from './types';

const first = AimsReviewOutputSchema.parse({
  executiveSummary: 'First',
  confidence: 0.8,
  uncertainties: ['Missing date'],
  findings: [
    {
      id: 'F-1',
      category: 'record',
      severity: 'medium',
      statement: 'Owner is unclear',
      evidenceRefs: ['[L2]'],
    },
  ],
});

describe('mergeAimsReviewOutputs', () => {
  it('merges broad output fields and requires a human decision', () => {
    const output = mergeAimsReviewOutputs([
      first,
      AimsReviewOutputSchema.parse({ executiveSummary: 'Second', confidence: 0.4 }),
    ]);
    expect(output.executiveSummary).toContain('First');
    expect(output.executiveSummary).toContain('Second');
    expect(output.confidence).toBe(0.6);
    expect(output.humanDecisionRequired).toBe(true);
  });

  it('deduplicates identical structured findings', () => {
    expect(mergeAimsReviewOutputs([first, first]).findings).toHaveLength(1);
  });

  it('rejects an empty merge', () => {
    expect(() => mergeAimsReviewOutputs([])).toThrow('At least one');
  });
});
