/**
 * FlowOps - LLM Client
 *
 * OpenAI互換API対応のマルチプロバイダーLLMクライアント
 * OpenAI / Anthropic / Google Gemini / Azure / Ollama / Groq 等に対応
 */

import OpenAI from 'openai';
import { ProposalOutputSchema, ProposalOutput, JsonPatch } from '../patch/types';
import { checkForbiddenPaths } from '../patch/apply';
import { buildFullPrompt } from './prompts';
import { getTraceId } from '@/lib/trace-context';

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
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
  /** JSON modeをサポートしないプロバイダーの場合 false に設定 */
  supportsJsonMode?: boolean;
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
  private supportsJsonMode: boolean;

  constructor(config: LLMClientConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });
    this.model = config.model || 'gpt-4o';
    this.maxTokens = config.maxTokens ?? 2048;
    this.temperature = config.temperature ?? 0.3;
    this.supportsJsonMode = config.supportsJsonMode ?? true;
  }

  /**
   * 提案を生成（API_ERROR時は最大2回リトライ）
   */
  async generateProposal(params: GenerateProposalParams): Promise<ProposalOutput> {
    const maxRetries = 2;
    let lastError: LLMError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const output = await this.callLLM(params);
        this.validateProposalConstraints(output, params.roles, params.systems);
        return output;
      } catch (error) {
        const llmError =
          error instanceof LLMError
            ? error
            : new LLMError(
                'API_ERROR',
                `LLM API error: ${error instanceof Error ? error.message : error}`
              );

        // API_ERROR以外はリトライしない
        if (llmError.code !== 'API_ERROR' || attempt === maxRetries) {
          throw llmError;
        }

        lastError = llmError;
        // ジッター付き指数バックオフ（thundering herd防止）
        const delay = 1000 * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError ?? new LLMError('API_ERROR', 'Unknown error after retries');
  }

  private async callLLM(params: GenerateProposalParams): Promise<ProposalOutput> {
    const { system, user } = buildFullPrompt(params);

    // Trace IDをLiteLLM/Langfuseに転送
    const traceId = getTraceId();
    const traceMetadata = traceId ? { extra_headers: { 'X-Trace-Id': traceId } } : {};

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      ...(this.supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
      ...traceMetadata,
    } as OpenAI.ChatCompletionCreateParamsNonStreaming);

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new LLMError('API_ERROR', 'Empty response from LLM');
    }

    // JSONをパース（JSON mode非対応プロバイダー向けにフォールバック抽出）
    const parsed = this.extractJson(content);

    const result = ProposalOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new LLMError(
        'VALIDATION_ERROR',
        `LLM output validation failed: ${result.error.message}`
      );
    }

    return result.data;
  }

  /**
   * レスポンスからJSONを抽出
   * JSON modeが使える場合はそのままパース、
   * 使えない場合はマークダウンコードブロックやテキスト中のJSON部分を抽出
   */
  private extractJson(content: string): unknown {
    // まずそのままパースを試みる
    try {
      return JSON.parse(content);
    } catch {
      // フォールバック: ```json ... ``` ブロックを抽出
      const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        try {
          return JSON.parse(codeBlockMatch[1].trim());
        } catch {
          // fall through
        }
      }

      // フォールバック: 最初の { ... } ブロックを抽出
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          return JSON.parse(braceMatch[0]);
        } catch {
          // fall through
        }
      }

      throw new LLMError('PARSE_ERROR', 'Failed to extract valid JSON from LLM response');
    }
  }

  /**
   * LLM出力のセマンティック検証
   * - 禁止パス（/id）の変更チェック
   * - role/systemフィールドの辞書存在チェック
   */
  private validateProposalConstraints(
    output: ProposalOutput,
    roles?: string[],
    systems?: string[]
  ): void {
    const violations: string[] = [];

    // 禁止パスチェック
    const forbidden = checkForbiddenPaths(output.patches as JsonPatch[], ['/id']);
    violations.push(...forbidden);

    // role/systemの辞書存在チェック
    for (const patch of output.patches) {
      if ((patch.op === 'add' || patch.op === 'replace') && patch.path.endsWith('/role')) {
        if (roles && roles.length > 0) {
          if (typeof patch.value !== 'string' || !roles.includes(patch.value)) {
            violations.push(`Invalid or unknown role in patch: ${String(patch.value)}`);
          }
        }
      }
      if ((patch.op === 'add' || patch.op === 'replace') && patch.path.endsWith('/system')) {
        if (systems && systems.length > 0) {
          if (typeof patch.value !== 'string' || !systems.includes(patch.value)) {
            violations.push(`Invalid or unknown system in patch: ${String(patch.value)}`);
          }
        }
      }
    }

    if (violations.length > 0) {
      throw new LLMError('VALIDATION_ERROR', `Constraint violations: ${violations.join('; ')}`);
    }
  }
}

/**
 * プロバイダー別のデフォルト設定
 */
const PROVIDER_DEFAULTS: Record<
  string,
  { baseURL: string; model: string; supportsJsonMode: boolean }
> = {
  openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o', supportsJsonMode: true },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5-20250929',
    supportsJsonMode: false,
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    supportsJsonMode: true,
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    supportsJsonMode: true,
  },
  ollama: { baseURL: 'http://localhost:11434/v1', model: 'llama3.2', supportsJsonMode: true },
};

/**
 * 環境変数からLLMクライアントを生成
 *
 * 環境変数:
 *   LLM_PROVIDER  - プロバイダー名 (openai, anthropic, gemini, groq, ollama, custom)
 *   LLM_API_KEY   - APIキー
 *   LLM_BASE_URL  - カスタムベースURL（LLM_PROVIDERのデフォルトを上書き）
 *   LLM_MODEL     - モデル名（LLM_PROVIDERのデフォルトを上書き）
 *   LLM_JSON_MODE - JSON modeサポート ("true"/"false", デフォルトはプロバイダー依存)
 *
 * 後方互換:
 *   OPENAI_API_KEY / OPENAI_MODEL も引き続き使用可能
 */
export function createLLMClient(config?: Partial<LLMClientConfig>): LLMClient {
  const provider = process.env.LLM_PROVIDER || 'openai';
  const defaults = PROVIDER_DEFAULTS[provider];

  const apiKey = config?.apiKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('LLM_API_KEY (or OPENAI_API_KEY) is not set');
  }

  const baseURL = config?.baseURL || process.env.LLM_BASE_URL || defaults?.baseURL;

  const model =
    config?.model ||
    process.env.LLM_MODEL ||
    process.env.OPENAI_MODEL ||
    defaults?.model ||
    'gpt-4o';

  const supportsJsonMode =
    config?.supportsJsonMode ??
    (process.env.LLM_JSON_MODE !== undefined
      ? process.env.LLM_JSON_MODE === 'true'
      : (defaults?.supportsJsonMode ?? true));

  return new LLMClient({
    apiKey,
    baseURL,
    model,
    maxTokens: config?.maxTokens,
    temperature: config?.temperature,
    supportsJsonMode,
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

/** シングルトンをリセット（テスト用、設定変更後の再初期化用） */
export function resetLLMClient(): void {
  defaultClient = null;
}

export { LLMClient };
