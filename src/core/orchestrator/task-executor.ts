/**
 * FlowOps - Task Executor
 *
 * 単一マイクロタスクの実行エンジン
 * LLMクライアントを通じてタスクを実行し、I/O検証を行う
 */

import OpenAI from 'openai';
import { MicroTaskDefinition, TaskInvocation, TaskResult } from './schemas/micro-task';
import { getTraceId } from '@/lib/trace-context';
import { extractJson } from '@/lib/extract-json';
import { abstractionEngine } from '@/core/data/abstraction';

const LEVEL_ORDER: Record<string, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
  L5: 5,
};

export class TaskExecutionError extends Error {
  code:
    | 'LLM_ERROR'
    | 'VALIDATION_ERROR'
    | 'TIMEOUT'
    | 'UNSUPPORTED_TYPE'
    | 'DATA_GOVERNANCE_VIOLATION';

  constructor(
    code:
      | 'LLM_ERROR'
      | 'VALIDATION_ERROR'
      | 'TIMEOUT'
      | 'UNSUPPORTED_TYPE'
      | 'DATA_GOVERNANCE_VIOLATION',
    message: string
  ) {
    super(message);
    this.name = 'TaskExecutionError';
    this.code = code;
  }
}

export interface TaskExecutorConfig {
  llmBaseUrl: string;
  llmApiKey: string;
  defaultModel: string;
}

/**
 * テンプレート文字列の変数を置換（Mustache形式: {{variable}}）
 */
function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
  });
}

export class TaskExecutor {
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: TaskExecutorConfig) {
    this.client = new OpenAI({
      apiKey: config.llmApiKey,
      baseURL: config.llmBaseUrl,
    });
    this.defaultModel = config.defaultModel;
  }

  /**
   * マイクロタスクを実行
   */
  async execute(task: MicroTaskDefinition, invocation: TaskInvocation): Promise<TaskResult> {
    const startTime = Date.now();
    const traceId = invocation.traceId || getTraceId() || '';

    // データガバナンスチェック (GPTsiteki)
    if (task.dataGovernance) {
      const govResult = this.checkDataGovernance(task, invocation);
      if (!govResult.allowed) {
        return {
          traceId,
          executionId: invocation.executionId,
          taskId: task.id,
          status: 'failure',
          output: {},
          metadata: { durationMs: Date.now() - startTime },
          error: {
            code: 'DATA_GOVERNANCE_VIOLATION',
            message: govResult.reason,
          },
        };
      }
      if (govResult.processedInput) {
        invocation = { ...invocation, input: govResult.processedInput };
      }
    }

    try {
      switch (task.type) {
        case 'llm-inference':
          return await this.executeLlmTask(task, invocation, startTime);
        case 'human-review':
          return {
            traceId,
            executionId: invocation.executionId,
            taskId: task.id,
            status: 'needs-human-review',
            output: {},
            metadata: { durationMs: Date.now() - startTime },
          };
        default:
          throw new TaskExecutionError(
            'UNSUPPORTED_TYPE',
            `Task type '${task.type}' is not yet supported`
          );
      }
    } catch (error) {
      if (error instanceof TaskExecutionError) throw error;

      return {
        traceId,
        executionId: invocation.executionId,
        taskId: task.id,
        status: 'failure',
        output: {},
        metadata: { durationMs: Date.now() - startTime },
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private async executeLlmTask(
    task: MicroTaskDefinition,
    invocation: TaskInvocation,
    startTime: number
  ): Promise<TaskResult> {
    if (!task.llmConfig) {
      throw new TaskExecutionError(
        'VALIDATION_ERROR',
        `Task '${task.id}' is type 'llm-inference' but missing llmConfig`
      );
    }

    const model = task.llmConfig.model || this.defaultModel;
    const userPrompt = renderTemplate(task.llmConfig.userPromptTemplate, invocation.input);

    const traceId = invocation.traceId;
    const traceMetadata = traceId ? { extra_headers: { 'X-Trace-Id': traceId } } : {};

    let retries = 0;
    const maxRetries = task.maxRetries;

    while (retries <= maxRetries) {
      try {
        const response = await this.client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: task.llmConfig.systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: task.llmConfig.temperature ?? 0.3,
          max_tokens: task.llmConfig.maxTokens ?? 2048,
          response_format: { type: 'json_object' },
          ...traceMetadata,
        } as OpenAI.ChatCompletionCreateParamsNonStreaming);

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new TaskExecutionError('LLM_ERROR', 'Empty response from LLM');
        }

        let output: unknown;
        try {
          output = extractJson(content);
        } catch {
          throw new TaskExecutionError(
            'VALIDATION_ERROR',
            `Failed to extract JSON from LLM response: ${content.substring(0, 200)}`
          );
        }
        const usage = response.usage;

        return {
          traceId,
          executionId: invocation.executionId,
          taskId: task.id,
          status: task.requiresHumanApproval ? 'needs-human-review' : 'success',
          output: output as Record<string, unknown>,
          metadata: {
            durationMs: Date.now() - startTime,
            llmModelUsed: model,
            llmTokensUsed: usage
              ? { input: usage.prompt_tokens, output: usage.completion_tokens }
              : undefined,
          },
        };
      } catch (error) {
        if (error instanceof TaskExecutionError) throw error;
        if (retries >= maxRetries) {
          throw new TaskExecutionError(
            'LLM_ERROR',
            `LLM call failed after ${maxRetries + 1} attempts: ${error instanceof Error ? error.message : error}`
          );
        }
        retries++;
        const delay = 1000 * Math.pow(2, retries - 1) * (0.5 + Math.random() * 0.5);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new TaskExecutionError('LLM_ERROR', 'Unreachable');
  }

  /**
   * データガバナンスチェック
   *
   * タスク定義の dataGovernance に基づき、入力データの機密レベルを検証。
   * 必要に応じて抽象化前処理を実行する。
   */
  private checkDataGovernance(
    task: MicroTaskDefinition,
    invocation: TaskInvocation
  ): { allowed: boolean; reason: string; processedInput?: Record<string, unknown> } {
    const governance = task.dataGovernance!;
    const maxInputLevel = LEVEL_ORDER[governance.maxSensitivityInput] ?? 2;

    // 入力データ内の sensitivityLevel フィールドを持つオブジェクトをチェック
    const processedInput: Record<string, unknown> = { ...invocation.input };
    let abstracted = false;

    for (const [key, value] of Object.entries(invocation.input)) {
      if (
        value &&
        typeof value === 'object' &&
        'sensitivityLevel' in (value as Record<string, unknown>)
      ) {
        const objLevel =
          LEVEL_ORDER[(value as Record<string, unknown>).sensitivityLevel as string] ?? 0;

        if (objLevel > maxInputLevel) {
          if (governance.requiresAbstractionPreprocessing) {
            // 抽象化前処理を実行
            const result = abstractionEngine.abstract(
              value as Parameters<typeof abstractionEngine.abstract>[0],
              'masking'
            );
            processedInput[key] = result.abstractedObject;
            abstracted = true;
          } else {
            return {
              allowed: false,
              reason: `Input '${key}' has sensitivity level ${(value as Record<string, unknown>).sensitivityLevel} exceeding max ${governance.maxSensitivityInput}`,
            };
          }
        }
      }
    }

    return {
      allowed: true,
      reason: 'ok',
      processedInput: abstracted ? processedInput : undefined,
    };
  }
}

/**
 * 環境変数からTaskExecutorを生成
 */
export function createTaskExecutor(config?: Partial<TaskExecutorConfig>): TaskExecutor {
  return new TaskExecutor({
    llmBaseUrl: config?.llmBaseUrl || process.env.LLM_BASE_URL || 'http://localhost:4000/v1',
    llmApiKey: config?.llmApiKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    defaultModel: config?.defaultModel || process.env.LLM_MODEL || 'gpt-4o',
  });
}
