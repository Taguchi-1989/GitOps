import { stableStringify } from '@/core/audit';
import { AIMS_REVIEW_SCHEMA_VERSION, AimsReviewOutput } from './types';

export function mergeAimsReviewOutputs(
  outputs: AimsReviewOutput[],
  mode: 'chunks' | 'fallback-synthesis' = 'chunks'
): AimsReviewOutput {
  if (outputs.length === 0) throw new Error('At least one AIMS review output is required');
  const averageConfidence =
    outputs.reduce((sum, output) => sum + output.confidence, 0) / outputs.length;

  return {
    schemaVersion: AIMS_REVIEW_SCHEMA_VERSION,
    reviewScope: joinDistinct(outputs.map(output => output.reviewScope)),
    executiveSummary: joinDistinct(outputs.map(output => output.executiveSummary)),
    sourceSummary: joinDistinct(outputs.map(output => output.sourceSummary)),
    claims: deduplicate(outputs.flatMap(output => output.claims)),
    controlAssessments: deduplicate(outputs.flatMap(output => output.controlAssessments)),
    risks: deduplicate(outputs.flatMap(output => output.risks)),
    findings: deduplicate(outputs.flatMap(output => output.findings)),
    uncertainties: [...new Set(outputs.flatMap(output => output.uncertainties))],
    disagreements: deduplicate(outputs.flatMap(output => output.disagreements)),
    recommendedActions: deduplicate(outputs.flatMap(output => output.recommendedActions)),
    humanDecisionRequired: true,
    confidence: Math.round(averageConfidence * 1_000) / 1_000,
    extensions: {
      mergeMode: mode,
      mergedOutputCount: outputs.length,
      sourceExtensions: outputs.map(output => output.extensions),
    },
  };
}

function joinDistinct(values: string[]): string {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].join('\n\n');
}

function deduplicate<T>(values: T[]): T[] {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = stableStringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
