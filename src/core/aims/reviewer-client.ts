import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { extractJson } from '@/lib/extract-json';
import { getTraceId } from '@/lib/trace-context';
import { resolveAimsApiKey } from './config';
import { AimsReviewOutput, AimsReviewOutputSchema, AimsReviewerConfig } from './types';

export interface AimsReviewCall {
  system: string;
  user: string;
}

export interface IAimsReviewerClient {
  generate(call: AimsReviewCall): Promise<AimsReviewOutput>;
}

export class AimsReviewerError extends Error {
  constructor(
    readonly code: 'API_ERROR' | 'PARSE_ERROR' | 'VALIDATION_ERROR',
    message: string
  ) {
    super(message);
    this.name = 'AimsReviewerError';
  }
}

export function createAimsReviewerClient(config: AimsReviewerConfig): IAimsReviewerClient {
  if (config.provider === 'dev-mock') return new DevMockAimsReviewerClient(config);
  const apiKey = resolveAimsApiKey(config);
  if (config.provider === 'anthropic') {
    return new AnthropicAimsReviewerClient(config, apiKey);
  }
  return new OpenAiCompatibleAimsReviewerClient(config, apiKey);
}

class OpenAiCompatibleAimsReviewerClient implements IAimsReviewerClient {
  private readonly client: OpenAI;

  constructor(
    private readonly config: AimsReviewerConfig,
    apiKey: string
  ) {
    this.client = new OpenAI({
      apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      timeout: 120_000,
      maxRetries: 2,
    });
  }

  async generate(call: AimsReviewCall): Promise<AimsReviewOutput> {
    try {
      const traceId = getTraceId();
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: call.system },
          { role: 'user', content: call.user },
        ],
        max_tokens: this.config.maxTokens ?? 4_096,
        temperature: this.config.temperature ?? 0.2,
        ...(this.config.supportsJsonMode === false
          ? {}
          : { response_format: { type: 'json_object' as const } }),
        ...(traceId ? { extra_headers: { 'X-Trace-Id': traceId } } : {}),
      } as OpenAI.ChatCompletionCreateParamsNonStreaming);
      const content = response.choices[0]?.message?.content;
      if (!content) throw new AimsReviewerError('API_ERROR', 'Empty response from reviewer');
      return parseAimsReview(content);
    } catch (error) {
      if (error instanceof AimsReviewerError) throw error;
      throw new AimsReviewerError(
        'API_ERROR',
        `Reviewer ${this.config.id} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

class AnthropicAimsReviewerClient implements IAimsReviewerClient {
  private readonly client: Anthropic;

  constructor(
    private readonly config: AimsReviewerConfig,
    apiKey: string
  ) {
    this.client = new Anthropic({
      apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      timeout: 120_000,
      maxRetries: 2,
    });
  }

  async generate(call: AimsReviewCall): Promise<AimsReviewOutput> {
    try {
      const message = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens ?? 4_096,
        temperature: this.config.temperature ?? 0.2,
        system: call.system,
        messages: [{ role: 'user', content: call.user }],
      });
      const content = message.content.find(block => block.type === 'text');
      if (!content || content.type !== 'text') {
        throw new AimsReviewerError('API_ERROR', 'Empty response from reviewer');
      }
      return parseAimsReview(content.text);
    } catch (error) {
      if (error instanceof AimsReviewerError) throw error;
      throw new AimsReviewerError(
        'API_ERROR',
        `Reviewer ${this.config.id} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

class DevMockAimsReviewerClient implements IAimsReviewerClient {
  constructor(private readonly config: AimsReviewerConfig) {}

  async generate(): Promise<AimsReviewOutput> {
    return AimsReviewOutputSchema.parse({
      executiveSummary: `Development mock review (${this.config.role})`,
      sourceSummary: 'No external LLM was called.',
      findings: [],
      humanDecisionRequired: true,
      confidence: 0,
      extensions: { mock: true, reviewerId: this.config.id },
    });
  }
}

export function parseAimsReview(content: string): AimsReviewOutput {
  let parsed: unknown;
  try {
    parsed = extractJson(content);
  } catch {
    throw new AimsReviewerError('PARSE_ERROR', 'Failed to extract reviewer JSON');
  }
  const result = AimsReviewOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new AimsReviewerError(
      'VALIDATION_ERROR',
      `Reviewer output does not match aims-review.v1: ${result.error.message}`
    );
  }
  return result.data;
}
