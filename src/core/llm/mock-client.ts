/**
 * FlowOps - Dev Mock LLM Client
 *
 * API キー不要のローカル開発用スタブ。
 * LLM_PROVIDER=dev-mock のとき使われる。
 * issueTitle / flowYaml を元にリアルな改善案を生成する。
 */

import { ProposalOutput } from '../patch/types';
import { LLMError, GenerateProposalParams } from './client';
import { parseFlowYaml } from '../parser';

export class MockLLMClient {
  async generateProposal(params: GenerateProposalParams): Promise<ProposalOutput> {
    await new Promise(r => setTimeout(r, 800)); // 思考中演出

    const { flowYaml, issueTitle } = params;
    const parseResult = parseFlowYaml(flowYaml);
    if (!parseResult.success || !parseResult.flow) {
      throw new LLMError('API_ERROR', 'Mock: failed to parse flow YAML');
    }

    const flow = parseResult.flow;
    const nodeIds = Object.keys(flow.nodes);
    if (nodeIds.length === 0) {
      throw new LLMError('API_ERROR', 'Mock: flow has no nodes');
    }

    // 最初の process ノードを改善対象に選ぶ
    const targetId = nodeIds.find(id => flow.nodes[id].type === 'process') ?? nodeIds[0];
    const target = flow.nodes[targetId];

    const hint = issueTitle.slice(0, 30);

    return {
      intent: `「${hint}」に対応するため、${target.label ?? targetId} ステップに確認フローを追加します。担当者が明示的に承認するまで次工程に進めないようにすることで、見落としを防ぎます。`,
      patches: [
        {
          op: 'replace',
          path: `/nodes/${targetId}/label`,
          value: `${target.label ?? targetId}（要確認）`,
        },
        {
          op: 'add',
          path: `/nodes/${targetId}/checkRequired`,
          value: true,
        },
        {
          op: 'add',
          path: `/nodes/check_${targetId}`,
          value: {
            id: `check_${targetId}`,
            type: 'decision',
            label: '確認完了？',
            role: target.role ?? '担当者',
          },
        },
      ],
    };
  }
}
