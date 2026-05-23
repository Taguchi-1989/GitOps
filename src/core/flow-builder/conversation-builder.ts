/**
 * FlowOps - Conversation-based Flow Builder
 *
 * 会話（チャット）を通じて業務フローのたたき台を作成する機能
 * ユーザーとの対話からMermaid図 + YAML定義を段階的に構築
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { Flow, FlowSchema } from '../parser/schema';
import { flowToMermaid } from '../parser/toMermaid';
import { stringifyFlow } from '../parser';
import { getTraceId } from '@/lib/trace-context';

// --------------------------------------------------------
// Types
// --------------------------------------------------------

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ConversationBuildRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  currentYaml: z.string().optional(),
  flowId: z.string().optional(),
  targetLayer: z.enum(['L0', 'L1', 'L2']).default('L1'),
  roles: z.array(z.string()).optional(),
  systems: z.array(z.string()).optional(),
});

export type ConversationBuildRequest = z.infer<typeof ConversationBuildRequestSchema>;

/** LLMが返すJSON構造 */
const ConversationOutputSchema = z.object({
  yaml: z.string().min(1),
  mermaid: z.string().min(1),
  questions: z.array(z.string()),
  summary: z.string().min(1),
});

export interface ConversationBuildResult {
  yaml: string;
  flow: Flow | null;
  mermaid: string;
  questions: string[];
  summary: string;
  validationErrors: string[];
}

// --------------------------------------------------------
// Builder
// --------------------------------------------------------

export class ConversationFlowBuilder {
  private client: OpenAI;
  private model: string;
  private supportsJsonMode: boolean;

  constructor(config: {
    apiKey: string;
    baseURL?: string;
    model?: string;
    supportsJsonMode?: boolean;
  }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });
    this.model = config.model || 'gpt-4o';
    this.supportsJsonMode = config.supportsJsonMode ?? true;
  }

  /**
   * 会話メッセージからフローを構築/更新
   */
  async build(request: ConversationBuildRequest): Promise<ConversationBuildResult> {
    const { system, messages: llmMessages } = this.buildPrompt(request);

    const traceId = getTraceId();
    const traceMetadata = traceId ? { extra_headers: { 'X-Trace-Id': traceId } } : {};

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'system', content: system }, ...llmMessages],
      max_tokens: 4096,
      temperature: 0.3,
      ...(this.supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
      ...traceMetadata,
    } as OpenAI.ChatCompletionCreateParamsNonStreaming);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    const parsed = this.extractJson(content);
    const output = ConversationOutputSchema.parse(parsed);

    // YAMLをパースしてFlowオブジェクトに変換
    const validationErrors: string[] = [];
    let flow: Flow | null = null;
    let mermaid = output.mermaid;

    try {
      const { parse: parseYaml } = await import('yaml');
      const rawData = parseYaml(output.yaml);
      const zodResult = FlowSchema.safeParse(rawData);

      if (zodResult.success) {
        flow = zodResult.data;
        // LLMのMermaidではなく、パーサーから正規のMermaidを生成
        mermaid = flowToMermaid(flow, { direction: 'TD', includeStyles: true });
      } else {
        zodResult.error.issues.forEach(e => {
          validationErrors.push(`${e.path.join('.')}: ${e.message}`);
        });
      }
    } catch (e) {
      validationErrors.push(`YAML parse error: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      yaml: output.yaml,
      flow,
      mermaid,
      questions: output.questions,
      summary: output.summary,
      validationErrors,
    };
  }

  private buildPrompt(request: ConversationBuildRequest): {
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    const { messages, currentYaml, targetLayer, roles = [], systems = [] } = request;

    const system =
      CONVERSATION_SYSTEM_PROMPT +
      (roles.length > 0 ? `\n\n## 使用可能なRole\n${roles.map(r => `- ${r}`).join('\n')}` : '') +
      (systems.length > 0
        ? `\n\n## 使用可能なSystem\n${systems.map(s => `- ${s}`).join('\n')}`
        : '') +
      `\n\n## 対象レイヤー: ${targetLayer}`;

    // 会話履歴をLLMメッセージに変換
    const llmMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (currentYaml) {
      llmMessages.push({
        role: 'user',
        content: `現在のフロー定義:\n\`\`\`yaml\n${currentYaml}\n\`\`\`\n\nこれを元に更新してください。`,
      });
    }

    for (const msg of messages) {
      llmMessages.push({ role: msg.role, content: msg.content });
    }

    return { system, messages: llmMessages };
  }

  private extractJson(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        try {
          return JSON.parse(codeBlockMatch[1].trim());
        } catch {
          /* fall through */
        }
      }
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          return JSON.parse(braceMatch[0]);
        } catch {
          /* fall through */
        }
      }
      throw new Error(`Failed to extract JSON from LLM response: ${content.substring(0, 200)}`);
    }
  }
}

// --------------------------------------------------------
// System Prompt
// --------------------------------------------------------

const CONVERSATION_SYSTEM_PROMPT = `あなたはFlowOps業務フロー設計アシスタントです。
ユーザーとの会話を通じて、業務フローのたたき台をYAML定義として構築します。

## あなたの役割
1. ユーザーの業務プロセスの説明を聞き取る
2. 段階的にフロー定義（YAML）とMermaid図を構築する
3. 不足している情報（担当者、使用システム、分岐条件）について質問する
4. ユーザーの「追加して」「変更して」「削除して」に応じてフローを更新する

## 出力形式
必ず以下のJSON形式で出力してください:
{
  "yaml": "YAML形式のフロー定義（文字列）",
  "mermaid": "Mermaid記法のフローチャート（文字列）",
  "questions": ["次にユーザーに確認すべき質問のリスト"],
  "summary": "今回の変更内容の要約"
}

## YAML構造ルール
- id: スネークケース（例: order-process）
- title: 日本語のフロー名
- layer: L0（目的）, L1（業務プロセス）, L2（システム手順）
- nodes: Record形式（配列ではない）
  - 各ノードにはid, type, labelが必須
  - type: start, end, process, decision, database, llm-task, human-review
  - role, system, meta はオプション
  - ノードIDはスネークケース（例: receive_order, check_stock）
- edges: Record形式
  - 各エッジにはid, from, toが必須
  - エッジIDはe1, e2, e3...の連番
  - decisionノードからのエッジにはlabelとconditionを付与
- updatedAt: 現在時刻のISO 8601形式

## Mermaid出力ルール
- graph TD形式
- ノードタイプに応じた形状を使用:
  - start/end: ([ラベル])
  - process: [ラベル]
  - decision: {ラベル}
  - database: [(ラベル)]

## 会話のルール
- 初回は最小限のフロー（start → 主要プロセス → end）を提案
- 毎回2-3個の質問で足りない情報を確認
- ユーザーが曖昧な場合はベストプラクティスを提案
- 既存フローがある場合はそれを元に差分更新

## 禁止事項
- spec/flows/ と spec/dict/ 以外への言及禁止
- 使用可能リストにないrole/systemの使用禁止（リストが空の場合は自由）
- JSON以外のテキスト出力禁止`;
