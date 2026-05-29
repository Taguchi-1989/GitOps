/**
 * FlowOps - AnthropicLLMClient Tests
 *
 * @anthropic-ai/sdk をモックし、成功・各種エラー・リトライ分岐を網羅する。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function (this: { messages: { create: typeof mockCreate } }) {
    this.messages = { create: mockCreate };
  }),
}));

import Anthropic from '@anthropic-ai/sdk';
import { AnthropicLLMClient } from './anthropic-client';
import { LLMError } from './client';

const params = {
  issueTitle: 'タイトル',
  issueDescription: '説明',
  flowYaml: 'id: flow_1\ntitle: テスト',
};

const validProposal = {
  intent: 'ラベルを更新する',
  patches: [{ op: 'replace', path: '/nodes/node_1/label', value: '新ラベル' }],
};

function textResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

describe('AnthropicLLMClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes apiKey, default model and maxTokens to the SDK', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(JSON.stringify(validProposal)));
    const client = new AnthropicLLMClient('sk-test');

    await client.generateProposal(params);

    expect(Anthropic).toHaveBeenCalledWith({ apiKey: 'sk-test' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001', max_tokens: 2048 })
    );
  });

  it('honors custom model and maxTokens', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(JSON.stringify(validProposal)));
    const client = new AnthropicLLMClient('sk-test', 'claude-opus-4-8', 4096);

    await client.generateProposal(params);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-8', max_tokens: 4096 })
    );
  });

  it('returns a validated proposal on a successful text response', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(JSON.stringify(validProposal)));
    const client = new AnthropicLLMClient('sk-test');

    const result = await client.generateProposal(params);

    expect(result.intent).toBe('ラベルを更新する');
    expect(result.patches).toHaveLength(1);
  });

  it('throws PARSE_ERROR when the response is not valid JSON', async () => {
    mockCreate.mockResolvedValueOnce(textResponse('これはJSONではありません'));
    const client = new AnthropicLLMClient('sk-test');

    await expect(client.generateProposal(params)).rejects.toMatchObject({ code: 'PARSE_ERROR' });
    // PARSE_ERROR はリトライ対象外なので 1 回だけ呼ばれる
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('throws VALIDATION_ERROR when JSON does not match the schema', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(JSON.stringify({ intent: '', patches: 'nope' })));
    const client = new AnthropicLLMClient('sk-test');

    await expect(client.generateProposal(params)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('retries on a transient API error and then succeeds', async () => {
    vi.useFakeTimers();
    mockCreate
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(textResponse(JSON.stringify(validProposal)));
    const client = new AnthropicLLMClient('sk-test');

    const promise = client.generateProposal(params);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.intent).toBe('ラベルを更新する');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('gives up with API_ERROR after exhausting retries', async () => {
    vi.useFakeTimers();
    mockCreate.mockRejectedValue(new Error('always down'));
    const client = new AnthropicLLMClient('sk-test');

    const promise = client.generateProposal(params);
    const assertion = expect(promise).rejects.toMatchObject({ code: 'API_ERROR' });
    await vi.runAllTimersAsync();
    await assertion;

    // maxRetries=2 → 初回 + 2 リトライ = 3 回
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('throws API_ERROR when the response has no text content', async () => {
    vi.useFakeTimers();
    mockCreate.mockResolvedValue({ content: [{ type: 'image' }] });
    const client = new AnthropicLLMClient('sk-test');

    const promise = client.generateProposal(params);
    const assertion = expect(promise).rejects.toMatchObject({ code: 'API_ERROR' });
    await vi.runAllTimersAsync();
    await assertion;
  });
});
