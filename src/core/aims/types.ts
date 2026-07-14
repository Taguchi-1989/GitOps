import { z } from 'zod';

export const AIMS_REVIEW_SCHEMA_VERSION = 'aims-review.v1' as const;
export const AIMS_PROMPT_VERSION = '1.0.0' as const;

export const AimsSensitivitySchema = z.enum(['L0', 'L1', 'L2', 'L3', 'L4', 'L5']);
export const AimsReviewerRoleSchema = z.enum([
  'summarizer',
  'auditor',
  'challenger',
  'synthesizer',
]);

export const CreateAimsEvidenceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sourceText: z
    .string()
    .min(1)
    .max(500_000)
    .refine(value => value.trim().length > 0, 'sourceText must contain non-whitespace text'),
  sourceType: z.string().trim().min(1).max(80).default('historical-text'),
  sourceLabel: z.string().trim().max(500).optional(),
  sensitivityLevel: AimsSensitivitySchema.default('L2'),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const StartAimsReviewSchema = z.object({
  objective: z.string().trim().min(1).max(2_000).optional(),
  reviewerIds: z.array(z.string().trim().min(1).max(80)).min(1).max(8).optional(),
});

export const AimsHumanDecisionSchema = z.object({
  decision: z.enum(['approved', 'revise', 'rejected']),
  reason: z.string().trim().min(1).max(4_000),
});

const EvidenceRefSchema = z.string().trim().min(1).max(80);

export const AimsClaimSchema = z.object({
  statement: z.string().trim().min(1),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const AimsControlAssessmentSchema = z.object({
  controlId: z.string().trim().min(1),
  status: z.enum(['supported', 'partial', 'gap', 'not-applicable', 'unknown']),
  rationale: z.string().trim().min(1),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
});

export const AimsRiskSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  likelihood: z.enum(['low', 'medium', 'high', 'unknown']).default('unknown'),
  impact: z.enum(['low', 'medium', 'high', 'critical', 'unknown']).default('unknown'),
  treatment: z.string().trim().default(''),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
});

export const AimsFindingSchema = z.object({
  id: z.string().trim().min(1),
  category: z.string().trim().min(1),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  statement: z.string().trim().min(1),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  recommendation: z.string().trim().default(''),
});

export const AimsReviewOutputSchema = z.object({
  schemaVersion: z.literal(AIMS_REVIEW_SCHEMA_VERSION).default(AIMS_REVIEW_SCHEMA_VERSION),
  reviewScope: z.string().trim().default(''),
  executiveSummary: z.string().trim().min(1),
  sourceSummary: z.string().trim().default(''),
  claims: z.array(AimsClaimSchema).default([]),
  controlAssessments: z.array(AimsControlAssessmentSchema).default([]),
  risks: z.array(AimsRiskSchema).default([]),
  findings: z.array(AimsFindingSchema).default([]),
  uncertainties: z.array(z.string().trim().min(1)).default([]),
  disagreements: z
    .array(
      z.object({
        topic: z.string().trim().min(1),
        positions: z.array(z.string().trim().min(1)).min(2),
        resolution: z.string().trim().default(''),
      })
    )
    .default([]),
  recommendedActions: z
    .array(
      z.object({
        priority: z.enum(['low', 'medium', 'high', 'urgent']),
        action: z.string().trim().min(1),
        owner: z.string().trim().optional(),
        dueHint: z.string().trim().optional(),
        controlIds: z.array(z.string().trim().min(1)).default([]),
      })
    )
    .default([]),
  humanDecisionRequired: z.boolean().default(true),
  confidence: z.number().min(0).max(1).default(0.5),
  extensions: z.record(z.string(), z.unknown()).default({}),
});

export const AimsReviewerConfigSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    role: AimsReviewerRoleSchema,
    provider: z.string().trim().min(1).max(40),
    model: z.string().trim().min(1).max(200),
    baseURL: z.url().optional(),
    apiKeyEnv: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .optional(),
    supportsJsonMode: z.boolean().optional(),
    maxTokens: z.number().int().min(512).max(32_768).optional(),
    temperature: z.number().min(0).max(2).optional(),
  })
  .strict();

export type CreateAimsEvidenceInput = z.infer<typeof CreateAimsEvidenceSchema>;
export type StartAimsReviewInput = z.infer<typeof StartAimsReviewSchema>;
export type AimsHumanDecision = z.infer<typeof AimsHumanDecisionSchema>;
export type AimsReviewOutput = z.infer<typeof AimsReviewOutputSchema>;
export type AimsReviewerRole = z.infer<typeof AimsReviewerRoleSchema>;
export type AimsReviewerConfig = z.infer<typeof AimsReviewerConfigSchema>;

export interface AimsSourceChunk {
  index: number;
  startLine: number;
  endLine: number;
  text: string;
}
