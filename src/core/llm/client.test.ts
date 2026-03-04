import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// -------------------------------------------------------
// Mocks
// -------------------------------------------------------
const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

vi.mock('@/lib/trace-context', () => ({
  getTraceId: vi.fn(),
}));

vi.mock('./prompts', () => ({
  buildFullPrompt: vi.fn(() => ({ system: 'sys', user: 'usr' })),
}));

// -------------------------------------------------------
// Imports (after mocks)
// -------------------------------------------------------
import { LLMError, createLLMClient, getLLMClient, resetLLMClient, LLMClient } from './client';
import { getTraceId } from '@/lib/trace-context';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
const validProposal = {
  intent: 'テスト修正',
  patches: [{ op: 'replace', path: '/nodes/n1/label', value: '新ラベル' }],
};

function mockLLMResponse(content: string | null) {
  mockCreate.mockResolvedValueOnce({
    choices: [{ message: { content } }],
  });
}

const defaultParams = {
  issueTitle: 'Test',
  issueDescription: 'Desc',
  flowYaml: 'id: flow_1',
};

// -------------------------------------------------------
// Env helpers
// -------------------------------------------------------
let savedEnv: NodeJS.ProcessEnv;
let setTimeoutSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  savedEnv = { ...process.env };
  // Provide a default API key so tests don't fail on missing key
  process.env.OPENAI_API_KEY = 'test-key';
  // Clean up LLM-related env vars to avoid cross-contamination
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_JSON_MODE;
  delete process.env.OPENAI_MODEL;

  resetLLMClient();
  mockCreate.mockReset();
  vi.mocked(getTraceId).mockReturnValue(undefined);

  // Make setTimeout resolve immediately to speed up retry tests
  setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: TimerHandler) => {
    if (typeof fn === 'function') fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  });
});

afterEach(() => {
  process.env = savedEnv;
  // Only restore the setTimeout spy, not all mocks
  if (setTimeoutSpy) {
    setTimeoutSpy.mockRestore();
    setTimeoutSpy = null;
  }
});

// ===============================================================
// LLMError
// ===============================================================
describe('LLMError', () => {
  it('should have the correct name property', () => {
    const err = new LLMError('API_ERROR', 'test message');
    expect(err.name).toBe('LLMError');
  });

  it('should store the error code', () => {
    const err = new LLMError('PARSE_ERROR', 'parse failed');
    expect(err.code).toBe('PARSE_ERROR');
    expect(err.message).toBe('parse failed');
  });

  it('should be an instance of Error', () => {
    const err = new LLMError('VALIDATION_ERROR', 'bad');
    expect(err).toBeInstanceOf(Error);
  });
});

// ===============================================================
// createLLMClient
// ===============================================================
describe('createLLMClient', () => {
  it('should create a client when OPENAI_API_KEY is set', () => {
    const client = createLLMClient();
    expect(client).toBeInstanceOf(LLMClient);
  });

  it('should throw when no API key is available', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;
    expect(() => createLLMClient()).toThrow('LLM_API_KEY (or OPENAI_API_KEY) is not set');
  });

  it('should prefer LLM_API_KEY over OPENAI_API_KEY', () => {
    process.env.LLM_API_KEY = 'llm-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    const client = createLLMClient();
    expect(client).toBeInstanceOf(LLMClient);
  });

  it('should use anthropic provider defaults when LLM_PROVIDER=anthropic', () => {
    process.env.LLM_PROVIDER = 'anthropic';
    const client = createLLMClient();
    expect(client).toBeInstanceOf(LLMClient);
  });

  it('should use gemini provider defaults when LLM_PROVIDER=gemini', () => {
    process.env.LLM_PROVIDER = 'gemini';
    const client = createLLMClient();
    expect(client).toBeInstanceOf(LLMClient);
  });

  it('should use groq provider defaults when LLM_PROVIDER=groq', () => {
    process.env.LLM_PROVIDER = 'groq';
    const client = createLLMClient();
    expect(client).toBeInstanceOf(LLMClient);
  });

  it('should respect LLM_JSON_MODE=false env var', () => {
    process.env.LLM_JSON_MODE = 'false';
    const client = createLLMClient();
    expect(client).toBeInstanceOf(LLMClient);
  });

  it('should respect LLM_JSON_MODE=true env var', () => {
    process.env.LLM_JSON_MODE = 'true';
    const client = createLLMClient();
    expect(client).toBeInstanceOf(LLMClient);
  });

  it('should allow config overrides', () => {
    const client = createLLMClient({
      apiKey: 'override-key',
      model: 'custom-model',
      baseURL: 'https://custom.api/v1',
      maxTokens: 4096,
      temperature: 0.7,
      supportsJsonMode: false,
    });
    expect(client).toBeInstanceOf(LLMClient);
  });

  it('should use OPENAI_MODEL when LLM_MODEL is not set', () => {
    process.env.OPENAI_MODEL = 'gpt-4-turbo';
    const client = createLLMClient();
    expect(client).toBeInstanceOf(LLMClient);
  });
});

// ===============================================================
// getLLMClient / resetLLMClient
// ===============================================================
describe('getLLMClient / resetLLMClient', () => {
  it('should return a singleton instance', () => {
    const a = getLLMClient();
    const b = getLLMClient();
    expect(a).toBe(b);
  });

  it('should create a new instance after resetLLMClient', () => {
    const a = getLLMClient();
    resetLLMClient();
    const b = getLLMClient();
    expect(a).not.toBe(b);
  });
});

// ===============================================================
// LLMClient.generateProposal
// ===============================================================
describe('LLMClient.generateProposal', () => {
  // ----- Success path -----
  it('should return a valid proposal on successful generation', async () => {
    mockLLMResponse(JSON.stringify(validProposal));
    const client = createLLMClient({ apiKey: 'test-key' });
    const result = await client.generateProposal(defaultParams);
    expect(result.intent).toBe('テスト修正');
    expect(result.patches).toHaveLength(1);
    expect(result.patches[0].op).toBe('replace');
  });

  // ----- Empty response -----
  it('should throw API_ERROR on empty response', async () => {
    // All retry attempts return null content
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });
    const client = createLLMClient({ apiKey: 'test-key' });
    try {
      await client.generateProposal(defaultParams);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LLMError);
      expect((e as LLMError).code).toBe('API_ERROR');
      expect((e as LLMError).message).toContain('Empty response');
    }
  });

  // ----- Invalid JSON (PARSE_ERROR) -----
  it('should throw PARSE_ERROR for completely unparseable content', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'this is not json at all !!!' } }],
    });
    const client = createLLMClient({ apiKey: 'test-key' });
    try {
      await client.generateProposal(defaultParams);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LLMError);
      expect((e as LLMError).code).toBe('PARSE_ERROR');
    }
  });

  // ----- Validation failure (bad schema) -----
  it('should throw VALIDATION_ERROR when schema validation fails', async () => {
    // Missing required "intent" field
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ patches: [] }) } }],
    });
    const client = createLLMClient({ apiKey: 'test-key' });
    try {
      await client.generateProposal(defaultParams);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LLMError);
      expect((e as LLMError).code).toBe('VALIDATION_ERROR');
    }
  });

  // ----- API_ERROR retry logic -----
  it('should retry on API_ERROR and succeed on second attempt', async () => {
    // First call: throws a generic error (wraps to API_ERROR)
    mockCreate.mockRejectedValueOnce(new Error('network timeout'));
    // Second call: succeeds
    mockLLMResponse(JSON.stringify(validProposal));

    const client = createLLMClient({ apiKey: 'test-key' });
    const result = await client.generateProposal(defaultParams);
    expect(result.intent).toBe('テスト修正');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should exhaust retries and throw on persistent API_ERROR', async () => {
    mockCreate.mockRejectedValue(new Error('persistent failure'));
    const client = createLLMClient({ apiKey: 'test-key' });
    try {
      await client.generateProposal(defaultParams);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LLMError);
      expect((e as LLMError).code).toBe('API_ERROR');
    }
    // 1 initial + 2 retries = 3 total calls
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  // ----- Non-API errors don't retry -----
  it('should not retry PARSE_ERROR', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json !!!' } }],
    });
    const client = createLLMClient({ apiKey: 'test-key' });
    try {
      await client.generateProposal(defaultParams);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LLMError);
      expect((e as LLMError).code).toBe('PARSE_ERROR');
    }
    // PARSE_ERROR should not retry: only 1 call
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should not retry VALIDATION_ERROR', async () => {
    // Valid JSON but bad schema (missing intent)
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ patches: [] }) } }],
    });
    const client = createLLMClient({ apiKey: 'test-key' });
    try {
      await client.generateProposal(defaultParams);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LLMError);
      expect((e as LLMError).code).toBe('VALIDATION_ERROR');
    }
    // VALIDATION_ERROR should not retry: only 1 call
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  // ----- Constraint violations -----
  it('should throw VALIDATION_ERROR for forbidden path /id', async () => {
    const proposal = {
      intent: 'change id',
      patches: [{ op: 'replace', path: '/id', value: 'new-id' }],
    };
    mockLLMResponse(JSON.stringify(proposal));
    const client = createLLMClient({ apiKey: 'test-key' });
    try {
      await client.generateProposal(defaultParams);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LLMError);
      expect((e as LLMError).code).toBe('VALIDATION_ERROR');
      expect((e as LLMError).message).toContain('Forbidden path');
    }
  });

  it('should throw VALIDATION_ERROR for unknown role', async () => {
    const proposal = {
      intent: 'add role',
      patches: [{ op: 'add', path: '/nodes/n1/role', value: 'unknown-role' }],
    };
    mockLLMResponse(JSON.stringify(proposal));
    const client = createLLMClient({ apiKey: 'test-key' });
    try {
      await client.generateProposal({
        ...defaultParams,
        roles: ['manager', 'engineer'],
      });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LLMError);
      expect((e as LLMError).code).toBe('VALIDATION_ERROR');
      expect((e as LLMError).message).toContain('unknown role');
    }
  });

  it('should throw VALIDATION_ERROR for unknown system', async () => {
    const proposal = {
      intent: 'add system',
      patches: [{ op: 'replace', path: '/nodes/n1/system', value: 'unknown-system' }],
    };
    mockLLMResponse(JSON.stringify(proposal));
    const client = createLLMClient({ apiKey: 'test-key' });
    try {
      await client.generateProposal({
        ...defaultParams,
        systems: ['Slack', 'JIRA'],
      });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LLMError);
      expect((e as LLMError).code).toBe('VALIDATION_ERROR');
      expect((e as LLMError).message).toContain('unknown system');
    }
  });

  it('should pass when role is in the allowed list', async () => {
    const proposal = {
      intent: 'set role',
      patches: [{ op: 'add', path: '/nodes/n1/role', value: 'manager' }],
    };
    mockLLMResponse(JSON.stringify(proposal));
    const client = createLLMClient({ apiKey: 'test-key' });
    const result = await client.generateProposal({
      ...defaultParams,
      roles: ['manager', 'engineer'],
    });
    expect(result.intent).toBe('set role');
  });

  it('should skip role validation when roles list is empty', async () => {
    const proposal = {
      intent: 'set role',
      patches: [{ op: 'add', path: '/nodes/n1/role', value: 'any-role' }],
    };
    mockLLMResponse(JSON.stringify(proposal));
    const client = createLLMClient({ apiKey: 'test-key' });
    const result = await client.generateProposal({
      ...defaultParams,
      roles: [],
    });
    expect(result.intent).toBe('set role');
  });

  it('should wrap non-LLMError exceptions as API_ERROR', async () => {
    mockCreate.mockRejectedValue(new TypeError('unexpected type error'));
    const client = createLLMClient({ apiKey: 'test-key' });
    try {
      await client.generateProposal(defaultParams);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LLMError);
      expect((e as LLMError).code).toBe('API_ERROR');
      expect((e as LLMError).message).toContain('unexpected type error');
    }
  });
});

// ===============================================================
// extractJson (tested indirectly via generateProposal)
// ===============================================================
describe('extractJson via generateProposal', () => {
  it('should parse direct JSON', async () => {
    mockLLMResponse(JSON.stringify(validProposal));
    const client = createLLMClient({ apiKey: 'test-key' });
    const result = await client.generateProposal(defaultParams);
    expect(result.intent).toBe('テスト修正');
  });

  it('should extract JSON from markdown code block', async () => {
    const content = `Here is my proposal:\n\`\`\`json\n${JSON.stringify(validProposal)}\n\`\`\`\nDone.`;
    mockLLMResponse(content);
    const client = createLLMClient({ apiKey: 'test-key' });
    const result = await client.generateProposal(defaultParams);
    expect(result.intent).toBe('テスト修正');
  });

  it('should extract JSON from code block without json language tag', async () => {
    const content = `\`\`\`\n${JSON.stringify(validProposal)}\n\`\`\``;
    mockLLMResponse(content);
    const client = createLLMClient({ apiKey: 'test-key' });
    const result = await client.generateProposal(defaultParams);
    expect(result.intent).toBe('テスト修正');
  });

  it('should extract JSON from brace-delimited content', async () => {
    const content = `Some text before ${JSON.stringify(validProposal)} some text after`;
    mockLLMResponse(content);
    const client = createLLMClient({ apiKey: 'test-key' });
    const result = await client.generateProposal(defaultParams);
    expect(result.intent).toBe('テスト修正');
  });

  it('should throw PARSE_ERROR for completely unparseable content', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'No JSON here at all' } }],
    });
    const client = createLLMClient({ apiKey: 'test-key' });
    try {
      await client.generateProposal(defaultParams);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LLMError);
      expect((e as LLMError).code).toBe('PARSE_ERROR');
      expect((e as LLMError).message).toContain('Failed to extract valid JSON');
    }
  });
});

// ===============================================================
// Trace ID propagation
// ===============================================================
describe('trace ID propagation', () => {
  it('should include X-Trace-Id header when traceId is available', async () => {
    vi.mocked(getTraceId).mockReturnValue('trace-abc-123');
    mockLLMResponse(JSON.stringify(validProposal));
    const client = createLLMClient({ apiKey: 'test-key' });
    await client.generateProposal(defaultParams);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        extra_headers: { 'X-Trace-Id': 'trace-abc-123' },
      })
    );
  });

  it('should not include extra_headers when traceId is undefined', async () => {
    vi.mocked(getTraceId).mockReturnValue(undefined);
    mockLLMResponse(JSON.stringify(validProposal));
    const client = createLLMClient({ apiKey: 'test-key' });
    await client.generateProposal(defaultParams);

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg).not.toHaveProperty('extra_headers');
  });
});
