import { prisma } from '@/lib/prisma';
import type { CreateAimsEvidenceInput, AimsHumanDecision, AimsReviewerConfig } from '@/core/aims';

export class AimsDecisionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AimsDecisionConflictError';
  }
}

export const aimsRepository = {
  async createEvidence(
    input: CreateAimsEvidenceInput & {
      evidenceId: string;
      sourceText: string;
      sourceHash: string;
      collectedBy: string;
    }
  ) {
    return prisma.aimsEvidence.create({
      data: {
        evidenceId: input.evidenceId,
        title: input.title,
        sourceText: input.sourceText,
        sourceHash: input.sourceHash,
        sourceType: input.sourceType,
        sourceLabel: input.sourceLabel,
        sensitivityLevel: input.sensitivityLevel,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
        collectedBy: input.collectedBy,
        tagsJson: JSON.stringify(input.tags),
        metadataJson: JSON.stringify(input.metadata),
      },
    });
  },

  async findEvidence(id: string) {
    return prisma.aimsEvidence.findFirst({
      where: { OR: [{ id }, { evidenceId: id }] },
      include: {
        reviews: {
          include: { modelReviews: { orderBy: { createdAt: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },

  async listEvidence(options: { limit: number; offset: number; status?: string }) {
    const where = options.status ? { status: options.status } : {};
    const [records, total] = await Promise.all([
      prisma.aimsEvidence.findMany({
        where,
        omit: { sourceText: true },
        include: { _count: { select: { reviews: true } } },
        orderBy: { createdAt: 'desc' },
        take: options.limit,
        skip: options.offset,
      }),
      prisma.aimsEvidence.count({ where }),
    ]);
    return { records, total };
  },

  async createRun(input: {
    evidenceId: string;
    traceId: string;
    objective?: string;
    reviewers: AimsReviewerConfig[];
    synthesizer?: AimsReviewerConfig;
    initiatedBy: string;
    policyVersion: string;
  }) {
    return prisma.$transaction(async tx => {
      const run = await tx.aimsReviewRun.create({
        data: {
          evidenceId: input.evidenceId,
          traceId: input.traceId,
          status: 'running',
          strategy: input.synthesizer
            ? 'independent-then-synthesis'
            : 'independent-then-deterministic',
          objective: input.objective,
          reviewerSetJson: JSON.stringify(input.reviewers),
          synthesisConfigJson: input.synthesizer ? JSON.stringify(input.synthesizer) : undefined,
          initiatedBy: input.initiatedBy,
          policyVersion: input.policyVersion,
        },
      });
      await tx.aimsEvidence.update({
        where: { id: input.evidenceId },
        data: { status: 'under-review' },
      });
      return run;
    });
  },

  createModelReview(input: { runId: string; config: AimsReviewerConfig; promptVersion: string }) {
    return prisma.aimsModelReview.create({
      data: {
        runId: input.runId,
        reviewerId: input.config.id,
        role: input.config.role,
        provider: input.config.provider,
        model: input.config.model,
        promptVersion: input.promptVersion,
        status: 'running',
      },
    });
  },

  completeModelReview(
    id: string,
    input: {
      status: 'success' | 'partial';
      inputHash: string;
      outputJson: string;
      chunkOutputsJson: string;
      outputHash: string;
      chunkCount: number;
      durationMs: number;
      error?: string;
    }
  ) {
    return prisma.aimsModelReview.update({
      where: { id },
      data: { ...input, completedAt: new Date() },
    });
  },

  failModelReview(
    id: string,
    input: {
      inputHash?: string;
      chunkOutputsJson?: string;
      chunkCount: number;
      durationMs: number;
      error: string;
    }
  ) {
    return prisma.aimsModelReview.update({
      where: { id },
      data: { status: 'failed', ...input, completedAt: new Date() },
    });
  },

  async completeRun(input: {
    runId: string;
    evidenceId: string;
    status: 'completed' | 'partial';
    finalOutputJson: string;
    finalOutputHash: string;
  }) {
    return prisma.$transaction(async tx => {
      const run = await tx.aimsReviewRun.update({
        where: { id: input.runId },
        data: {
          status: input.status,
          finalOutputJson: input.finalOutputJson,
          finalOutputHash: input.finalOutputHash,
          completedAt: new Date(),
        },
        include: { modelReviews: { orderBy: { createdAt: 'asc' } } },
      });
      await tx.aimsEvidence.update({
        where: { id: input.evidenceId },
        data: { status: 'reviewed' },
      });
      return run;
    });
  },

  async failRun(runId: string, evidenceId: string, restoreEvidenceStatus = 'imported') {
    await prisma.$transaction([
      prisma.aimsReviewRun.update({
        where: { id: runId },
        data: { status: 'failed', completedAt: new Date() },
      }),
      prisma.aimsEvidence.update({
        where: { id: evidenceId },
        data: { status: restoreEvidenceStatus },
      }),
    ]);
  },

  findRun(id: string) {
    return prisma.aimsReviewRun.findFirst({
      where: { OR: [{ id }, { traceId: id }] },
      include: {
        evidence: { omit: { sourceText: true } },
        modelReviews: { orderBy: { createdAt: 'asc' } },
      },
    });
  },

  async recordDecision(runId: string, decision: AimsHumanDecision, decidedBy: string) {
    return prisma.$transaction(async tx => {
      const existing = await tx.aimsReviewRun.findUnique({ where: { id: runId } });
      if (!existing) return null;
      if (!['completed', 'partial'].includes(existing.status)) {
        throw new AimsDecisionConflictError('Review is not ready for a human decision');
      }
      if (existing.humanDecision) {
        throw new AimsDecisionConflictError('A human decision has already been recorded');
      }
      const run = await tx.aimsReviewRun.update({
        where: { id: runId },
        data: {
          humanDecision: decision.decision,
          humanDecisionReason: decision.reason,
          decidedBy,
          decidedAt: new Date(),
        },
        include: { modelReviews: { orderBy: { createdAt: 'asc' } } },
      });
      await tx.aimsEvidence.update({
        where: { id: existing.evidenceId },
        data: {
          status:
            decision.decision === 'approved'
              ? 'approved'
              : decision.decision === 'rejected'
                ? 'rejected'
                : 'reviewed',
        },
      });
      return run;
    });
  },
};

export function serializeAimsRecord<T>(record: T): T {
  if (Array.isArray(record)) return record.map(serializeAimsRecord) as T;
  if (!record || typeof record !== 'object' || record instanceof Date) return record;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
    if (key.endsWith('Json') && typeof value === 'string') {
      result[key.slice(0, -4)] = safeJson(value);
    } else {
      result[key] = serializeAimsRecord(value);
    }
  }
  return result as T;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
