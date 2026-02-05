/**
 * FlowOps - LLM Client
 * 
 * OpenAI API クライアント
 */

import OpenAI from 'openai';
import { ProposalOutputSchema, ProposalOutput } from '../patch/types';
import { buildFullPrompt } from './prompts';

export class LLMError extends Error {
  code: 'API_ERROR' | 'PARSE_ERROR' | 'VALIDATION_ERROR';
  
  constructor(code: 'API_ERROR' | 'PARSE_ERROR' | 'VALIDATION_ERROR', message: string) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
  }
}

export interface LLMClientConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateProposalParams {
  issueTitle: string;
  issueDescription: string;
  flowYaml: string;
  roles?: string[];
  systems?: string[];
}

class LLMClient {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: LLMClientConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'gpt-4o';
    this.maxTokens = config.maxTokens || 2048;
    this.temperature = config.temperature || 0.3;
  }

  /**
   * 提案を生成
   */
  async generateProposal(params: GenerateProposalParams): Promise<ProposalOutput> {
    const { system, user } = buildFullPrompt(params);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new LLMError('API_ERROR', 'Empty response from LLM');
      }

      // JSONパース
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        throw new LLMError('PARSE_ERROR', `Failed to parse LLM response as JSON: ${content}`);
      }

      // Zodバリデーション
      const result = ProposalOutputSchema.safeParse(parsed);
      if (!result.success) {
        throw new LLMError(
          'VALIDATION_ERROR',
          `LLM output validation failed: ${result.error.message}`
        );
      }

      return result.data;

    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      
      if (error instanceof OpenAI.APIError) {
        throw new LLMError('API_ERROR', `OpenAI API error: ${error.message}`);
      }
      
      throw new LLMError('API_ERROR', `Unknown error: ${error}`);
    }
  }
}

// ファクトリ関数
export function createLLMClient(config?: Partial<LLMClientConfig>): LLMClient {
  const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  
  return new LLMClient({
    apiKey,
    model: config?.model || process.env.OPENAI_MODEL || 'gpt-4o',
    maxTokens: config?.maxTokens,
    temperature: config?.temperature,
  });
}

// シングルトン（遅延初期化）
let defaultClient: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!defaultClient) {
    defaultClient = createLLMClient();
  }
  return defaultClient;
}

export { LLMClient };
