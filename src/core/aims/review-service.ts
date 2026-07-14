import { auditLog, hashContent, sha256Hex, stableStringify } from '@/core/audit';
import { guardIngress } from '@/core/ingress';
import { guardEgress } from '@/core/egress';
import { aimsRepository } from '@/lib/aims-repository';
import { generateTraceId, runWithTraceId } from '@/lib/trace-context';
import { loadAimsReviewerConfigs, selectAimsReviewers } from './config';
import { mergeAimsReviewOutputs } from './merge';
import { buildAimsReviewPrompt, buildAimsSynthesisPrompt } from './prompts';
import { createAimsReviewerClient, IAimsReviewerClient } from './reviewer-client';
import { chunkAimsSource, normalizeAimsSource } from './source';
import {
  AIMS_PROMPT_VERSION,
  AimsReviewOutput,
  AimsReviewerConfig,
  StartAimsReviewInput,
} from './types';

interface EvidenceForReview {
  id: string;
  evidenceId: string;
  title: string;
  sourceText: string;
  sourceHash: string;
  status: string;
}

export class AimsReviewExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AimsReviewExecutionError';
  }
}

export async function executeAimsReview(input: {
  evidence: EvidenceForReview;
  request: StartAimsReviewInput;
  actor: string;
  traceId?: string;
}) {
  const traceId = input.traceId || generateTraceId();
  return runWithTraceId(traceId, async () => executeWithinTrace({ ...input, traceId }));
}

async function executeWithinTrace(input: {
  evidence: EvidenceForReview;
  request: StartAimsReviewInput;
  actor: string;
  traceId: string;
}) {
  const configs = loadAimsReviewerConfigs();
  const { reviewers, synthesizer } = selectAimsReviewers(configs, input.request.reviewerIds);
  // Validate size before creating a durable run. Masking may change length only slightly;
  // the masked source is chunked again immediately before calls.
  const sourceChunks = chunkAimsSource(input.evidence.sourceText);

  const run = await aimsRepository.createRun({
    evidenceId: input.evidence.id,
    traceId: input.traceId,
    objective: input.request.objective,
    reviewers,
    synthesizer,
    initiatedBy: input.actor,
    policyVersion: AIMS_PROMPT_VERSION,
  });

  await auditLog.record({
    action: 'AIMS_REVIEW_START',
    entityType: 'AimsReviewRun',
    entityId: run.id,
    traceId: input.traceId,
    actor: input.actor,
    policyVersion: AIMS_PROMPT_VERSION,
    severity: 'thick',
    payload: {
      evidenceId: input.evidence.evidenceId,
      sourceHash: input.evidence.sourceHash,
      reviewers: reviewers.map(reviewer => ({
        id: reviewer.id,
        role: reviewer.role,
        provider: reviewer.provider,
        model: reviewer.model,
      })),
      synthesizer: synthesizer
        ? { id: synthesizer.id, provider: synthesizer.provider, model: synthesizer.model }
        : null,
    },
  });

  try {
    const guardedObjective = await guardIngress(
      { objective: input.request.objective || '' },
      {
        entityId: run.id,
        entityType: 'AimsReviewRun',
        actor: input.actor,
      }
    );
    const chunks = [] as typeof sourceChunks;
    for (const chunk of sourceChunks) {
      // Scan each bounded chunk independently. This keeps the deterministic
      // ingress scanner below its anti-ReDoS limit even for multi-chunk evidence.
      const guardedChunk = await guardIngress(
        { sourceText: chunk.text },
        {
          entityId: run.id,
          entityType: 'AimsReviewRun',
          actor: input.actor,
        }
      );
      chunks.push({ ...chunk, text: guardedChunk.fields.sourceText });
    }
    const reviewResults = await executeIndependentReviews({
      runId: run.id,
      title: input.evidence.title,
      sourceHash: input.evidence.sourceHash,
      objective: guardedObjective.fields.objective || undefined,
      reviewers,
      chunks,
      actor: input.actor,
    });

    const successful = reviewResults.filter(
      (result): result is ReviewerResult & { output: AimsReviewOutput } => Boolean(result.output)
    );
    if (successful.length === 0) {
      throw new AimsReviewExecutionError('All independent AIMS reviewers failed');
    }

    let finalOutput: AimsReviewOutput;
    let synthesisFailed = false;
    if (synthesizer) {
      try {
        finalOutput = await executeSynthesis({
          runId: run.id,
          title: input.evidence.title,
          sourceHash: input.evidence.sourceHash,
          objective: guardedObjective.fields.objective || undefined,
          synthesizer,
          reviews: successful.map(result => ({
            reviewerId: result.config.id,
            role: result.config.role,
            output: result.output,
          })),
          actor: input.actor,
        });
      } catch {
        synthesisFailed = true;
        finalOutput = mergeAimsReviewOutputs(
          successful.map(result => result.output),
          'fallback-synthesis'
        );
      }
    } else {
      finalOutput = mergeAimsReviewOutputs(
        successful.map(result => result.output),
        'fallback-synthesis'
      );
    }

    await guardEgress(finalOutput, {
      entityId: run.id,
      entityType: 'AimsReviewRun',
      actor: input.actor,
    });
    const finalOutputJson = stableStringify(finalOutput);
    const finalOutputHash = sha256Hex(finalOutputJson);
    const hasIndependentFailure = reviewResults.some(result => result.status !== 'success');
    const status = hasIndependentFailure || synthesisFailed ? 'partial' : 'completed';
    const completed = await aimsRepository.completeRun({
      runId: run.id,
      evidenceId: input.evidence.id,
      status,
      finalOutputJson,
      finalOutputHash,
    });

    await auditLog.record({
      action: 'AIMS_REVIEW_COMPLETE',
      entityType: 'AimsReviewRun',
      entityId: run.id,
      traceId: input.traceId,
      actor: input.actor,
      policyVersion: AIMS_PROMPT_VERSION,
      severity: status === 'completed' ? 'thin' : 'thick',
      payload: {
        status,
        successfulReviewers: successful.map(result => result.config.id),
        failedReviewers: reviewResults
          .filter(result => result.status !== 'success')
          .map(result => result.config.id),
        synthesisMode: synthesizer && !synthesisFailed ? 'llm' : 'deterministic-fallback',
        finalOutputHash,
        humanDecisionRequired: true,
      },
    });

    return completed;
  } catch (error) {
    await aimsRepository.failRun(run.id, input.evidence.id, input.evidence.status);
    await auditLog.record({
      action: 'AIMS_REVIEW_COMPLETE',
      entityType: 'AimsReviewRun',
      entityId: run.id,
      traceId: input.traceId,
      actor: input.actor,
      policyVersion: AIMS_PROMPT_VERSION,
      severity: 'full',
      payload: { status: 'failed', errorType: errorName(error) },
    });
    throw error;
  }
}

interface ReviewerResult {
  config: AimsReviewerConfig;
  status: 'success' | 'partial' | 'failed';
  output?: AimsReviewOutput;
}

async function executeIndependentReviews(input: {
  runId: string;
  title: string;
  sourceHash: string;
  objective?: string;
  reviewers: AimsReviewerConfig[];
  chunks: ReturnType<typeof chunkAimsSource>;
  actor: string;
}): Promise<ReviewerResult[]> {
  return Promise.all(
    input.reviewers.map(config =>
      executeOneReviewer({
        ...input,
        config,
      })
    )
  );
}

async function executeOneReviewer(input: {
  runId: string;
  title: string;
  sourceHash: string;
  objective?: string;
  config: AimsReviewerConfig;
  chunks: ReturnType<typeof chunkAimsSource>;
  actor: string;
}): Promise<ReviewerResult> {
  const startedAt = Date.now();
  const record = await aimsRepository.createModelReview({
    runId: input.runId,
    config: input.config,
    promptVersion: AIMS_PROMPT_VERSION,
  });
  const prompts = input.chunks.map(chunk =>
    buildAimsReviewPrompt({
      role: input.config.role as Exclude<typeof input.config.role, 'synthesizer'>,
      title: input.title,
      sourceHash: input.sourceHash,
      objective: input.objective,
      chunk,
      chunkCount: input.chunks.length,
    })
  );
  const inputHash = hashContent(prompts) || undefined;
  const chunkResults: Array<{
    chunkIndex: number;
    startLine: number;
    endLine: number;
    output?: AimsReviewOutput;
    error?: string;
  }> = [];

  let client: IAimsReviewerClient;
  try {
    client = createAimsReviewerClient(input.config);
  } catch (error) {
    const safeError = sanitizeOperationalError(error);
    await aimsRepository.failModelReview(record.id, {
      inputHash,
      chunkCount: 0,
      durationMs: Date.now() - startedAt,
      error: safeError,
    });
    await recordModelAudit(input, 'failed', undefined, errorName(error));
    return { config: input.config, status: 'failed' };
  }

  for (let index = 0; index < input.chunks.length; index += 1) {
    const chunk = input.chunks[index];
    try {
      const output = await client.generate(prompts[index]);
      await guardEgress(output, {
        entityId: record.id,
        entityType: 'AimsReviewRun',
        actor: input.actor,
      });
      chunkResults.push({
        chunkIndex: chunk.index,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        output,
      });
    } catch (error) {
      chunkResults.push({
        chunkIndex: chunk.index,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        error: sanitizeOperationalError(error),
      });
    }
  }

  const outputs = chunkResults.flatMap(result => (result.output ? [result.output] : []));
  if (outputs.length === 0) {
    const errorTypes = chunkResults.filter(result => result.error).map(result => result.error);
    await aimsRepository.failModelReview(record.id, {
      inputHash,
      chunkOutputsJson: stableStringify(chunkResults),
      chunkCount: input.chunks.length,
      durationMs: Date.now() - startedAt,
      error: errorTypes.join(' | ').slice(0, 2_000) || 'No valid chunk output',
    });
    await recordModelAudit(input, 'failed', undefined, 'chunk-review-failed');
    return { config: input.config, status: 'failed' };
  }

  const output = mergeAimsReviewOutputs(outputs, 'chunks');
  const outputJson = stableStringify(output);
  const outputHash = sha256Hex(outputJson);
  const status = outputs.length === input.chunks.length ? 'success' : 'partial';
  await aimsRepository.completeModelReview(record.id, {
    status,
    inputHash: inputHash || '',
    outputJson,
    chunkOutputsJson: stableStringify(chunkResults),
    outputHash,
    chunkCount: input.chunks.length,
    durationMs: Date.now() - startedAt,
    ...(status === 'partial' ? { error: 'One or more review chunks failed' } : {}),
  });
  await recordModelAudit(input, status, outputHash);
  return { config: input.config, status, output };
}

async function executeSynthesis(input: {
  runId: string;
  title: string;
  sourceHash: string;
  objective?: string;
  synthesizer: AimsReviewerConfig;
  reviews: Array<{ reviewerId: string; role: string; output: AimsReviewOutput }>;
  actor: string;
}): Promise<AimsReviewOutput> {
  const startedAt = Date.now();
  const record = await aimsRepository.createModelReview({
    runId: input.runId,
    config: input.synthesizer,
    promptVersion: AIMS_PROMPT_VERSION,
  });
  const prompt = buildAimsSynthesisPrompt(input);
  const inputHash = hashContent(prompt) || undefined;
  try {
    const client = createAimsReviewerClient(input.synthesizer);
    const output = await client.generate(prompt);
    await guardEgress(output, {
      entityId: record.id,
      entityType: 'AimsReviewRun',
      actor: input.actor,
    });
    const outputJson = stableStringify(output);
    const outputHash = sha256Hex(outputJson);
    await aimsRepository.completeModelReview(record.id, {
      status: 'success',
      inputHash: inputHash || '',
      outputJson,
      chunkOutputsJson: stableStringify([{ output }]),
      outputHash,
      chunkCount: 1,
      durationMs: Date.now() - startedAt,
    });
    await recordModelAudit(
      { runId: input.runId, config: input.synthesizer, actor: input.actor },
      'success',
      outputHash
    );
    return output;
  } catch (error) {
    await aimsRepository.failModelReview(record.id, {
      inputHash,
      chunkCount: 1,
      durationMs: Date.now() - startedAt,
      error: sanitizeOperationalError(error),
    });
    await recordModelAudit(
      { runId: input.runId, config: input.synthesizer, actor: input.actor },
      'failed',
      undefined,
      errorName(error)
    );
    throw error;
  }
}

async function recordModelAudit(
  input: { runId: string; config: AimsReviewerConfig; actor: string },
  status: 'success' | 'partial' | 'failed',
  outputHash?: string,
  errorType?: string
) {
  await auditLog.record({
    action: 'AIMS_MODEL_REVIEW',
    entityType: 'AimsReviewRun',
    entityId: input.runId,
    actor: input.actor,
    policyVersion: AIMS_PROMPT_VERSION,
    severity: status === 'success' ? 'thin' : 'thick',
    payload: {
      reviewerId: input.config.id,
      role: input.config.role,
      provider: input.config.provider,
      model: input.config.model,
      status,
      outputHash,
      errorType,
    },
  });
}

function sanitizeOperationalError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return message
    .replace(/(?:sk|key|token)-[A-Za-z0-9_.-]{8,}/gi, '[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .slice(0, 2_000);
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

export function computeAimsSourceHash(sourceText: string): string {
  return sha256Hex(normalizeAimsSource(sourceText));
}
