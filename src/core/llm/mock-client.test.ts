/**
 * FlowOps - MockLLMClient Tests
 *
 * dev-mock プロバイダー用スタブの分岐網羅テスト。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockLLMClient } from './mock-client';
import { LLMError } from './client';

const validFlowYaml = `id: test-flow
title: テストフロー
layer: L1
updatedAt: '2026-01-01T00:00:00+09:00'
nodes:
  start_1:
    id: start_1
    type: start
    label: 開始
  proc_1:
    id: proc_1
    type: process
    label: 注文処理
    role: 担当者
  end_1:
    id: end_1
    type: end
    label: 終了
edges:
  e1:
    id: e1
    from: start_1
    to: proc_1
  e2:
    id: e2
    from: proc_1
    to: end_1
`;

// process ノードを含まないフロー（?? nodeIds[0] フォールバック分岐用）
const noProcessFlowYaml = `id: test-flow
title: テストフロー
layer: L1
updatedAt: '2026-01-01T00:00:00+09:00'
nodes:
  start_1:
    id: start_1
    type: start
    label: 開始
  end_1:
    id: end_1
    type: end
    label: 終了
edges:
  e1:
    id: e1
    from: start_1
    to: end_1
`;

const baseParams = {
  issueTitle: 'リードタイムが長すぎて顧客対応が遅れる',
  issueDescription: '注文処理の確認が漏れることがある',
  flowYaml: validFlowYaml,
};

describe('MockLLMClient', () => {
  let client: MockLLMClient;

  beforeEach(() => {
    client = new MockLLMClient();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates a proposal targeting the first process node', async () => {
    const promise = client.generateProposal(baseParams);
    await vi.advanceTimersByTimeAsync(800);
    const result = await promise;

    expect(result.intent).toContain('注文処理');
    expect(result.patches).toHaveLength(3);
    // process ノード (proc_1) が改善対象に選ばれる
    expect(result.patches[0]).toMatchObject({ op: 'replace', path: '/nodes/proc_1/label' });
    expect(result.patches[1]).toMatchObject({ op: 'add', path: '/nodes/proc_1/checkRequired' });
    expect(result.patches[2]).toMatchObject({ op: 'add', path: '/nodes/check_proc_1' });
  });

  it('falls back to the first node when no process node exists', async () => {
    const promise = client.generateProposal({ ...baseParams, flowYaml: noProcessFlowYaml });
    await vi.advanceTimersByTimeAsync(800);
    const result = await promise;

    // process ノードが無いので先頭ノード (start_1) が対象
    expect(result.patches[0].path).toBe('/nodes/start_1/label');
  });

  it('truncates a long issue title to 30 chars in the intent hint', async () => {
    const longTitle = 'あ'.repeat(50);
    const promise = client.generateProposal({ ...baseParams, issueTitle: longTitle });
    await vi.advanceTimersByTimeAsync(800);
    const result = await promise;

    expect(result.intent).toContain('あ'.repeat(30));
    expect(result.intent).not.toContain('あ'.repeat(31));
  });

  it('throws API_ERROR when the YAML cannot be parsed', async () => {
    const promise = client.generateProposal({ ...baseParams, flowYaml: 'not: [a: valid: flow' });
    const assertion = expect(promise).rejects.toMatchObject({
      name: 'LLMError',
      code: 'API_ERROR',
    });
    await vi.advanceTimersByTimeAsync(800);
    await assertion;
  });
});
