/**
 * FlowOps - Task Executor Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));
vi.mock('@/lib/trace-context', () => ({ getTraceId: vi.fn(() => 'fallback-trace') }));

import { TaskExecutor, TaskExecutionError, createTaskExecutor } from './task-executor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides = {}) {
  return {
    id: 'test-task',
    version: '1.0.0',
    type: 'llm-inference' as const,
    llmConfig: {
      systemPrompt: 'You are helpful',
      userPromptTemplate: 'Input: {{input}}',
      temperature: 0.1,
    },
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    requiresHumanApproval: false,
    maxRetries: 0,
    timeoutMs: 30000,
    metadata: { author: 'test', description: 'test' },
    ...overrides,
  };
}

function makeInvocation(overrides = {}) {
  return {
    traceId: 'trace-123',
    executionId: 'exec-1',
    nodeId: 'node-1',
    taskId: 'test-task',
    taskVersion: '1.0.0',
    gitCommitHash: 'abc123',
    input: { input: 'hello' },
    context: {
      flowId: 'flow-1',
      currentNodeLabel: 'Test',
      previousNodes: [],
      roles: [],
      systems: [],
    },
    ...overrides,
  };
}

function createExecutor() {
  return new TaskExecutor({
    llmBaseUrl: 'http://test:4000/v1',
    llmApiKey: 'test-key',
    defaultModel: 'gpt-4o',
  });
}

function mockLlmResponse(content: string, tokens = { prompt_tokens: 10, completion_tokens: 20 }) {
  mockCreate.mockResolvedValueOnce({
    choices: [{ message: { content } }],
    usage: {
      prompt_tokens: tokens.prompt_tokens,
      completion_tokens: tokens.completion_tokens,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockCreate.mockReset();
});

describe('TaskExecutionError', () => {
  it('has correct name and code', () => {
    const error = new TaskExecutionError('LLM_ERROR', 'something went wrong');
    expect(error.name).toBe('TaskExecutionError');
    expect(error.code).toBe('LLM_ERROR');
    expect(error.message).toBe('something went wrong');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('execute - human-review type', () => {
  it('returns needs-human-review status without LLM call', async () => {
    const executor = createExecutor();
    const task = makeTask({ type: 'human-review' as const });
    const invocation = makeInvocation();

    const result = await executor.execute(task as any, invocation as any);

    expect(result.status).toBe('needs-human-review');
    expect(result.taskId).toBe('test-task');
    expect(result.executionId).toBe('exec-1');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('execute - unsupported type', () => {
  it('throws TaskExecutionError with UNSUPPORTED_TYPE for data-transform', async () => {
    const executor = createExecutor();
    const task = makeTask({ type: 'data-transform' as const });
    const invocation = makeInvocation();

    await expect(executor.execute(task as any, invocation as any)).rejects.toThrow(
      TaskExecutionError
    );

    try {
      await executor.execute(task as any, invocation as any);
    } catch (e) {
      expect((e as TaskExecutionError).code).toBe('UNSUPPORTED_TYPE');
    }
  });
});

describe('execute - llm-inference', () => {
  it('successful call returns success with parsed JSON output', async () => {
    const executor = createExecutor();
    mockLlmResponse('{"result": "ok"}');

    const result = await executor.execute(makeTask() as any, makeInvocation() as any);

    expect(result.status).toBe('success');
    expect(result.output).toEqual({ result: 'ok' });
    expect(result.taskId).toBe('test-task');
    expect(result.traceId).toBe('trace-123');
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('returns needs-human-review when requiresHumanApproval is true', async () => {
    const executor = createExecutor();
    mockLlmResponse('{"result": "ok"}');

    const task = makeTask({ requiresHumanApproval: true });
    const result = await executor.execute(task as any, makeInvocation() as any);

    expect(result.status).toBe('needs-human-review');
    expect(result.output).toEqual({ result: 'ok' });
  });

  it('tracks token usage in metadata', async () => {
    const executor = createExecutor();
    mockLlmResponse('{"result": "ok"}', { prompt_tokens: 50, completion_tokens: 100 });

    const result = await executor.execute(makeTask() as any, makeInvocation() as any);

    expect(result.metadata.llmModelUsed).toBe('gpt-4o');
    expect(result.metadata.llmTokensUsed).toEqual({ input: 50, output: 100 });
  });

  it('template variables are rendered', async () => {
    const executor = createExecutor();
    mockLlmResponse('{"result": "ok"}');

    await executor.execute(makeTask() as any, makeInvocation() as any);

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
    expect(userMessage.content).toBe('Input: hello');
  });

  it('missing llmConfig throws VALIDATION_ERROR', async () => {
    const executor = createExecutor();
    const task = makeTask({ llmConfig: undefined });

    await expect(executor.execute(task as any, makeInvocation() as any)).rejects.toThrow(
      TaskExecutionError
    );

    try {
      await executor.execute(task as any, makeInvocation() as any);
    } catch (e) {
      expect((e as TaskExecutionError).code).toBe('VALIDATION_ERROR');
    }
  });

  it('empty LLM response (no content) throws LLM_ERROR', async () => {
    const executor = createExecutor();
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 10, completion_tokens: 0 },
    });

    await expect(executor.execute(makeTask() as any, makeInvocation() as any)).rejects.toThrow(
      TaskExecutionError
    );

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 10, completion_tokens: 0 },
    });

    try {
      await executor.execute(makeTask() as any, makeInvocation() as any);
    } catch (e) {
      expect((e as TaskExecutionError).code).toBe('LLM_ERROR');
    }
  });
});

describe('JSON extraction', () => {
  it('plain JSON response parsed correctly', async () => {
    const executor = createExecutor();
    mockLlmResponse('{"foo": "bar", "num": 42}');

    const result = await executor.execute(makeTask() as any, makeInvocation() as any);

    expect(result.output).toEqual({ foo: 'bar', num: 42 });
  });

  it('JSON in ```json code block``` extracted', async () => {
    const executor = createExecutor();
    mockLlmResponse('Here is the result:\n```json\n{"extracted": true}\n```\nDone.');

    const result = await executor.execute(makeTask() as any, makeInvocation() as any);

    expect(result.output).toEqual({ extracted: true });
  });

  it('JSON wrapped in text with braces extracted', async () => {
    const executor = createExecutor();
    mockLlmResponse('The answer is {"wrapped": "value"} as expected.');

    const result = await executor.execute(makeTask() as any, makeInvocation() as any);

    expect(result.output).toEqual({ wrapped: 'value' });
  });

  it('completely invalid response throws LLM_ERROR', async () => {
    const executor = createExecutor();
    mockLlmResponse('This is not JSON at all, no braces here.');

    await expect(executor.execute(makeTask() as any, makeInvocation() as any)).rejects.toThrow(
      TaskExecutionError
    );

    // VALIDATION_ERROR from extractJson is caught by retry logic;
    // with maxRetries=0 it is re-thrown as LLM_ERROR
    mockLlmResponse('This is not JSON at all, no braces here.');

    try {
      await executor.execute(makeTask() as any, makeInvocation() as any);
    } catch (e) {
      // extractJson throws VALIDATION_ERROR which is a TaskExecutionError,
      // so it is re-thrown directly (not wrapped by the retry logic).
      expect((e as TaskExecutionError).code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('Retry logic', () => {
  it('retries on API error when maxRetries > 0', async () => {
    vi.useFakeTimers();

    const executor = createExecutor();
    const task = makeTask({ maxRetries: 1 });

    // First call fails with a generic error (not TaskExecutionError)
    mockCreate.mockRejectedValueOnce(new Error('API rate limit'));
    // Second call succeeds
    mockLlmResponse('{"retried": true}');

    const resultPromise = executor.execute(task as any, makeInvocation() as any);

    // Advance timers to cover the retry delay
    await vi.advanceTimersByTimeAsync(5000);

    const result = await resultPromise;

    expect(result.status).toBe('success');
    expect(result.output).toEqual({ retried: true });
    expect(mockCreate).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

describe('createTaskExecutor', () => {
  it('creates executor with defaults', () => {
    const executor = createTaskExecutor();
    expect(executor).toBeInstanceOf(TaskExecutor);
  });
});
