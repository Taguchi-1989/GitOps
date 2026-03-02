/**
 * FlowOps - Image-based Flow Reader
 *
 * 画像（フローチャート、ホワイトボード写真、手描き図）から
 * 業務フローを読み取り、YAML + Mermaidに変換する機能
 * 繰り返しフィードバックによる改善に対応
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { Flow, FlowSchema } from '../parser/schema';
import { flowToMermaid } from '../parser/toMermaid';
import { getTraceId } from '@/lib/trace-context';

// --------------------------------------------------------
// Types
// --------------------------------------------------------

export const ImageReadRequestSchema = z
  .object({
    /** Base64エンコードされた画像データ（data:image/...形式 or 純粋なbase64） */
    imageBase64: z.string().optional(),
    /** 画像のURL */
    imageUrl: z.string().url().optional(),
    /** 画像の補足説明 */
    imageDescription: z.string().optional(),
    /** 前回の結果に対するフィードバック（繰り返し改善用） */
    feedback: z.string().optional(),
    /** 前回生成されたYAML（フィードバックと併用） */
    currentYaml: z.string().optional(),
    /** フローID */
    flowId: z.string().optional(),
    /** 対象レイヤー */
    targetLayer: z.enum(['L0', 'L1', 'L2']).default('L1'),
    /** 使用可能なロール */
    roles: z.array(z.string()).optional(),
    /** 使用可能なシステム */
    systems: z.array(z.string()).optional(),
  })
  .refine(data => data.imageBase64 || data.imageUrl || data.currentYaml, {
    message: 'imageBase64, imageUrl, or currentYaml (with feedback) is required',
  });

export type ImageReadRequest = z.infer<typeof ImageReadRequestSchema>;

/** LLMが返すJSON構造 */
const ImageReadOutputSchema = z.object({
  yaml: z.string().min(1),
  mermaid: z.string().min(1),
  confidence: z.number().min(0).max(1),
  notes: z.array(z.string()),
  ambiguities: z.array(z.string()),
});

export interface ImageReadResult {
  yaml: string;
  flow: Flow | null;
  mermaid: string;
  confidence: number;
  notes: string[];
  ambiguities: string[];
  validationErrors: string[];
}

// --------------------------------------------------------
// Reader
// --------------------------------------------------------

export class ImageFlowReader {
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
    // Vision対応モデル
    this.model = config.model || 'gpt-4o';
    this.supportsJsonMode = config.supportsJsonMode ?? true;
  }

  /**
   * 画像からフローを読み取る / フィードバックで改善する
   */
  async read(request: ImageReadRequest): Promise<ImageReadResult> {
    const { system, userContent } = this.buildPrompt(request);

    const traceId = getTraceId();
    const traceMetadata = traceId ? { extra_headers: { 'X-Trace-Id': traceId } } : {};

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
      max_tokens: 4096,
      temperature: 0.2,
      ...(this.supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
      ...traceMetadata,
    } as OpenAI.ChatCompletionCreateParamsNonStreaming);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    const parsed = this.extractJson(content);
    const output = ImageReadOutputSchema.parse(parsed);

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
        zodResult.error.errors.forEach(e => {
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
      confidence: output.confidence,
      notes: output.notes,
      ambiguities: output.ambiguities,
      validationErrors,
    };
  }

  private buildPrompt(request: ImageReadRequest): {
    system: string;
    userContent: OpenAI.ChatCompletionContentPart[];
  } {
    const { roles = [], systems = [] } = request;

    let system = IMAGE_READER_SYSTEM_PROMPT;
    if (roles.length > 0) {
      system += `\n\n## 使用可能なRole\n${roles.map(r => `- ${r}`).join('\n')}`;
    }
    if (systems.length > 0) {
      system += `\n\n## 使用可能なSystem\n${systems.map(s => `- ${s}`).join('\n')}`;
    }
    system += `\n\n## 対象レイヤー: ${request.targetLayer}`;

    const userContent: OpenAI.ChatCompletionContentPart[] = [];

    // 画像の追加
    if (request.imageBase64) {
      const imageData = request.imageBase64.startsWith('data:')
        ? request.imageBase64
        : `data:image/png;base64,${request.imageBase64}`;

      userContent.push({
        type: 'image_url',
        image_url: { url: imageData, detail: 'high' },
      });
    } else if (request.imageUrl) {
      userContent.push({
        type: 'image_url',
        image_url: { url: request.imageUrl, detail: 'high' },
      });
    }

    // テキスト部分の構築
    const textParts: string[] = [];

    if (request.imageDescription) {
      textParts.push(`画像の補足説明: ${request.imageDescription}`);
    }

    if (request.currentYaml && request.feedback) {
      textParts.push(`前回の生成結果:\n\`\`\`yaml\n${request.currentYaml}\n\`\`\``);
      textParts.push(`フィードバック: ${request.feedback}`);
      textParts.push('上記のフィードバックを反映して、フロー定義を修正してください。');
    } else if (request.imageBase64 || request.imageUrl) {
      textParts.push(
        'この画像からフローチャートを読み取り、YAML形式のフロー定義を生成してください。'
      );
    }

    if (textParts.length > 0) {
      userContent.push({ type: 'text', text: textParts.join('\n\n') });
    }

    return { system, userContent };
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

const IMAGE_READER_SYSTEM_PROMPT = `あなたはFlowOps画像解析アシスタントです。
フローチャート画像（手描き、ホワイトボード写真、デジタル図面）から
業務フローを読み取り、構造化されたYAML定義に変換します。

## あなたの役割
1. 画像内のフローチャートの構造を正確に読み取る
2. ノード（箱、菱形、丸など）とエッジ（矢印、線）を特定する
3. テキストラベルを正確に読み取る（手書きの場合は最善の推測）
4. 読み取った内容をFlowOpsのYAML形式に変換する
5. 読み取りの確信度と曖昧な部分を報告する
6. フィードバックに基づいて修正する

## 出力形式
必ず以下のJSON形式で出力してください:
{
  "yaml": "YAML形式のフロー定義（文字列）",
  "mermaid": "Mermaid記法のフローチャート（文字列）",
  "confidence": 0.85,
  "notes": ["読み取り結果に関する注記のリスト"],
  "ambiguities": ["曖昧な箇所・不確実な読み取り結果のリスト"]
}

## YAML構造ルール
- id: スネークケース（画像のタイトルから推測、なければ "draft-flow"）
- title: 日本語のフロー名
- layer: 指定されたレイヤー
- updatedAt: 現在時刻のISO 8601形式
- nodes: Record形式
  - ノードIDはスネークケース（ラベルから自動生成）
  - 図形から type を推定:
    - 丸/楕円/角丸 → start または end
    - 四角/長方形 → process
    - 菱形/ひし形 → decision
    - 円柱/ドラム → database
  - ラベルのテキストを label に設定
- edges: Record形式
  - エッジIDは e1, e2, e3... の連番
  - 矢印の方向で from/to を決定
  - 分岐ラベルがあれば label と condition に設定

## 画像読み取りのコツ
- 手書き文字は文脈から最善の推測を行う
- 矢印の方向が不明確な場合は上→下、左→右を優先
- 色分けされている場合はmeta.colorとして記録
- 判別不能な要素はambiguitiesに報告

## フィードバック対応
- 前回の結果とフィードバックが与えられた場合、差分のみを修正
- 修正箇所をnotesで報告

## 禁止事項
- 画像に存在しない要素を勝手に追加しない
- 読み取れない文字を適当に補完しない（ambiguitiesに報告する）
- JSON以外のテキスト出力禁止`;
