/**
 * FlowOps - Flow Expander
 *
 * L0→L1→L2の段階的フロー展開
 * 上位レイヤーのフローを下位レイヤーに詳細化する
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { Flow, FlowSchema } from '../parser/schema';
import { flowToMermaid } from '../parser/toMermaid';
import { getTraceId } from '@/lib/trace-context';

// --------------------------------------------------------
// Types
// --------------------------------------------------------

export const FlowExpandRequestSchema = z
  .object({
    currentYaml: z.string().min(1),
    fromLayer: z.enum(['L0', 'L1']),
    toLayer: z.enum(['L1', 'L2']),
    /** 展開時の追加コンテキスト（ヒアリングメモ等） */
    context: z.string().optional(),
    roles: z.array(z.string()).optional(),
    systems: z.array(z.string()).optional(),
  })
  .refine(
    data =>
      (data.fromLayer === 'L0' && data.toLayer === 'L1') ||
      (data.fromLayer === 'L1' && data.toLayer === 'L2'),
    { message: 'Expansion must be L0→L1 or L1→L2' }
  );

export type FlowExpandRequest = z.infer<typeof FlowExpandRequestSchema>;

const ExpansionOutputSchema = z.object({
  yaml: z.string().min(1),
  mermaid: z.string().min(1),
  expandedNodes: z.array(z.string()),
  summary: z.string().min(1),
});

export interface FlowExpandResult {
  yaml: string;
  flow: Flow | null;
  mermaid: string;
  expandedNodes: string[];
  summary: string;
  validationErrors: string[];
}

// --------------------------------------------------------
// Expander
// --------------------------------------------------------

export class FlowExpander {
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
   * フローを下位レイヤーに展開
   */
  async expand(request: FlowExpandRequest): Promise<FlowExpandResult> {
    const { system, user } = this.buildPrompt(request);

    const traceId = getTraceId();
    const traceMetadata = traceId ? { extra_headers: { 'X-Trace-Id': traceId } } : {};

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
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
    const output = ExpansionOutputSchema.parse(parsed);

    // YAML検証
    const validationErrors: string[] = [];
    let flow: Flow | null = null;
    let mermaid = output.mermaid;

    try {
      const { parse: parseYaml } = await import('yaml');
      const rawData = parseYaml(output.yaml);
      const zodResult = FlowSchema.safeParse(rawData);

      if (zodResult.success) {
        flow = zodResult.data;
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
      expandedNodes: output.expandedNodes,
      summary: output.summary,
      validationErrors,
    };
  }

  private buildPrompt(request: FlowExpandRequest): { system: string; user: string } {
    const { currentYaml, fromLayer, toLayer, context, roles = [], systems = [] } = request;

    let system = fromLayer === 'L0' ? EXPANSION_L0_TO_L1_PROMPT : EXPANSION_L1_TO_L2_PROMPT;

    if (roles.length > 0) {
      system += `\n\n## 使用可能なRole\n${roles.map(r => `- ${r}`).join('\n')}`;
    }
    if (systems.length > 0) {
      system += `\n\n## 使用可能なSystem\n${systems.map(s => `- ${s}`).join('\n')}`;
    }

    let user = `## 展開対象のフロー定義\n\`\`\`yaml\n${currentYaml}\n\`\`\``;
    if (context) {
      user += `\n\n## 追加コンテキスト\n${context}`;
    }
    user += `\n\nこのフローを${fromLayer}から${toLayer}に展開してください。`;

    return { system, user };
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
// Prompts
// --------------------------------------------------------

const EXPANSION_L0_TO_L1_PROMPT = `あなたはFlowOps業務フロー展開アシスタントです。
L0レイヤー（目的・成果物レベル）のフローをL1レイヤー（業務プロセスレベル）に展開します。

## L0 → L1 展開ルール
- L0は「WHY（なぜ）」を定義: 業務の目的と成果物
- L1は「WHO/WHAT（誰が/何を）」を定義: 業務プロセスの手順

### 展開手順
1. L0の各ノード（start/end以外）を分析
2. 各ノードが表す業務目的を、具体的な業務手順に分解
3. 各手順にrole（担当者）とsystem（使用システム）を割り当て
4. 判断ポイント（decision）を特定し分岐条件を定義
5. 例外処理パスを追加（エラー、差し戻し等）

### 展開の目安
- L0の1ノード → L1の3-7ノードに展開
- startとendは保持
- decisionノードには必ず2つ以上の出力エッジを設定
- デフォルトパス（条件なしエッジ）を推奨

## 出力形式
必ず以下のJSON形式で出力:
{
  "yaml": "完全なL1レベルYAMLフロー定義",
  "mermaid": "Mermaid記法のフローチャート",
  "expandedNodes": ["展開されたL0ノードIDのリスト"],
  "summary": "展開内容の要約"
}

## YAML構造ルール
- layer を "L1" に変更
- nodes: Record形式、ノードIDはスネークケース
- edges: Record形式、エッジIDはe1, e2, e3...連番
- 各processノードにroleを必須で付与
- systemは該当する場合のみ付与

## 禁止事項
- 使用可能リストにないrole/systemの使用禁止
- id フィールドの変更禁止
- JSON以外のテキスト出力禁止`;

const EXPANSION_L1_TO_L2_PROMPT = `あなたはFlowOps業務フロー展開アシスタントです。
L1レイヤー（業務プロセスレベル）のフローをL2レイヤー（システム手順レベル）に展開します。

## L1 → L2 展開ルール
- L1は「WHO/WHAT（誰が/何を）」: 業務プロセスの手順
- L2は「HOW（どうやって）」: システム操作レベルの具体的手順

### 展開手順
1. L1の各processノードを分析
2. 各業務手順を、システム操作レベルの手順に分解:
   - 画面入力 → バリデーション → DB登録 → 通知送信 等
3. システム間連携ポイントを明示
4. LLMタスク（llm-task）や承認フロー（human-review）の挿入箇所を特定
5. エラーハンドリングパスを追加

### 展開の目安
- L1のprocessノード → L2の2-5ノードに展開
- API呼出、データ変換等の技術的なステップを追加
- llm-taskノードは自動化できる判断・生成処理に使用
- human-reviewノードは承認が必要な箇所に使用

## 出力形式
必ず以下のJSON形式で出力:
{
  "yaml": "完全なL2レベルYAMLフロー定義",
  "mermaid": "Mermaid記法のフローチャート",
  "expandedNodes": ["展開されたL1ノードIDのリスト"],
  "summary": "展開内容の要約"
}

## YAML構造ルール
- layer を "L2" に変更
- nodes: Record形式、ノードIDはスネークケース
- edges: Record形式、エッジIDはe1, e2, e3...連番
- llm-taskノードにはtaskIdを付与（spec/tasks/配下のファイル名）
- human-reviewノードにはrole（承認者）を必須付与
- meta.descriptionでシステム操作の具体的内容を記述

## 禁止事項
- 使用可能リストにないrole/systemの使用禁止
- id フィールドの変更禁止
- JSON以外のテキスト出力禁止`;
