/**
 * FlowOps - Anthropic (Claude) LLM Client
 *
 * @anthropic-ai/sdk を使ったネイティブ実装。
 * generateProposal インターフェースは LLMClient と共通。
 */

import Anthropic from '@anthropic-ai/sdk';
import { ProposalOutputSchema, ProposalOutput } from '../patch/types';
import { buildFullPrompt } from './prompts';
import { extractJson } from '@/lib/extract-json';
import { LLMError, GenerateProposalParams } from './client';

export class AnthropicLLMClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(apiKey: string, model?: string, maxTokens?: number, baseURL?: string) {
    // 差し替え可能点B（ガバナンス・ハーネス）: baseURL を与えればゲートウェイ(LiteLLM等)へ
    // routing 可能にする。未指定時のみ Anthropic 直結（直叩き）にフォールバック。
    // 直叩きを構造的に禁止したい運用では ANTHROPIC_BASE_URL を必ず設定する。
    this.client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
    this.model = model ?? 'claude-haiku-4-5-20251001';
    this.maxTokens = maxTokens ?? 2048;
  }

  async generateProposal(params: GenerateProposalParams): Promise<ProposalOutput> {
    const maxRetries = 2;
    let lastError: LLMError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.callClaude(params);
      } catch (error) {
        const llmError =
          error instanceof LLMError
            ? error
            : new LLMError(
                'API_ERROR',
                `Anthropic API error: ${error instanceof Error ? error.message : String(error)}`
              );

        if (llmError.code !== 'API_ERROR' || attempt === maxRetries) {
          throw llmError;
        }
        lastError = llmError;
        const delay = 1000 * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError ?? new LLMError('API_ERROR', 'Unknown error after retries');
  }

  private async callClaude(params: GenerateProposalParams): Promise<ProposalOutput> {
    const { system, user } = buildFullPrompt(params);

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const content = message.content[0];
    if (!content || content.type !== 'text') {
      throw new LLMError('API_ERROR', 'Empty or non-text response from Claude');
    }

    let parsed: unknown;
    try {
      parsed = extractJson(content.text);
    } catch {
      throw new LLMError('PARSE_ERROR', 'Failed to extract valid JSON from Claude response');
    }

    const result = ProposalOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new LLMError(
        'VALIDATION_ERROR',
        `Claude output validation failed: ${result.error.message}`
      );
    }

    return result.data;
  }
}
