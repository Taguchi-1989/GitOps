/**
 * FlowOps - LLM Prompts
 *
 * OpenAI API用のプロンプトテンプレート
 */

/**
 * システムプロンプト（基本）
 */
export const SYSTEM_PROMPT = `あなたはFlowOps業務フロー管理システムのアシスタントです。
ユーザーのIssue報告に基づいて、YAMLフロー定義の修正提案を生成します。

## あなたの役割
- ユーザーから報告されたIssue（問題・改善提案）を理解する
- 対象のYAMLフロー定義を分析する
- 具体的な修正案をJSON Patch形式で提案する

## 出力形式
必ず以下のJSON形式で出力してください。それ以外のテキストは出力しないでください：
{
  "intent": "変更意図の要約（日本語、1-2文）",
  "patches": [
    { "op": "replace", "path": "/nodes/node_123/label", "value": "新しいラベル" }
  ]
}

## JSON Patch操作
使用可能な操作：
- "add": 新しいプロパティ/要素を追加
- "remove": プロパティ/要素を削除
- "replace": 既存の値を置換

## パス形式
- ノードの変更: /nodes/{nodeId}/{property}
- エッジの変更: /edges/{edgeId}/{property}
- フロー属性: /title, /layer など`;

/**
 * 禁止事項プロンプト
 */
export const CONSTRAINTS_PROMPT = `
## 禁止事項（必ず守ること）
1. spec/flows/ と spec/dict/ 以外のファイルへの言及禁止
2. dict/roles.yaml にないroleを使用禁止
3. dict/systems.yaml にないsystemを使用禁止
4. 既存ノードIDの変更は原則禁止（新しいノードには新しいIDを使用）
5. フローのidフィールドの変更禁止
6. 説明文やマークダウンを出力禁止（純粋なJSONのみ）`;

/**
 * ユーザープロンプトテンプレートを生成
 */
export function generateUserPrompt(params: {
  issueTitle: string;
  issueDescription: string;
  flowYaml: string;
  roles?: string[];
  systems?: string[];
  expectedState?: string;
  hypothesisCause?: string;
  successMetric?: string;
}): string {
  const {
    issueTitle,
    issueDescription,
    flowYaml,
    roles = [],
    systems = [],
    expectedState,
    hypothesisCause,
    successMetric,
  } = params;

  let prompt = `## Issue情報
タイトル: ${issueTitle}
説明:
${issueDescription}

## 対象のYAMLフロー定義
\`\`\`yaml
${flowYaml}
\`\`\`
`;

  if (roles.length > 0) {
    prompt += `
## 使用可能なRole
${roles.map(r => `- ${r}`).join('\n')}
`;
  }

  if (systems.length > 0) {
    prompt += `
## 使用可能なSystem
${systems.map(s => `- ${s}`).join('\n')}
`;
  }

  if (expectedState || hypothesisCause || successMetric) {
    prompt += `
## 改善の背景（PDCA Plan フェーズの情報）`;
    if (expectedState) prompt += `\n期待する状態: ${expectedState}`;
    if (hypothesisCause) prompt += `\n原因の仮説: ${hypothesisCause}`;
    if (successMetric) prompt += `\n効果を測る指標: ${successMetric}`;
    prompt += '\n';
  }

  prompt += `
上記のIssueを解決するための修正提案をJSON形式で出力してください。`;

  return prompt;
}

/**
 * フル プロンプトを組み立て
 */
export function buildFullPrompt(params: {
  issueTitle: string;
  issueDescription: string;
  flowYaml: string;
  roles?: string[];
  systems?: string[];
  // PDCA Plan コンテキスト（あれば注入）
  expectedState?: string;
  hypothesisCause?: string;
  successMetric?: string;
}): { system: string; user: string } {
  return {
    system: SYSTEM_PROMPT + CONSTRAINTS_PROMPT,
    user: generateUserPrompt(params),
  };
}

/**
 * 現場ヒアリング用プロンプトを生成
 * 改善カードの記入が不十分な場合にAIが問いかける
 */
export function buildInterviewPrompt(params: {
  issueTitle: string;
  issueDescription: string;
  currentSituation?: string;
}): { system: string; user: string } {
  const system = `あなたは現場改善の専門家です。
問題をPDCAサイクルで改善するために、現場担当者に適切な質問をします。
質問は5つ以内にし、答えやすく具体的な内容にしてください。
必ず以下のJSON形式で出力してください：
{
  "questions": [
    "質問1の内容",
    "質問2の内容"
  ]
}`;

  const user = `以下の改善カードについて、改善を進めるために必要な情報を聞き出す質問を作ってください。

## 改善カードのタイトル
${params.issueTitle}

## 説明
${params.issueDescription}

${params.currentSituation ? `## 現状の困りごと\n${params.currentSituation}` : ''}

以下の観点から重要な質問を選んでください：
- どの作業・プロセスで起きているか
- どれくらいの頻度で発生するか
- 誰が困っているか（影響範囲）
- 改善後に何が減れば成功か（成功指標）
- 今すぐ小さく試せる対策は何か`;

  return { system, user };
}

/**
 * 効果指標提案プロンプト
 * Issue内容から測定可能な指標を提案する
 */
export function buildMetricSuggestionPrompt(params: {
  issueTitle: string;
  issueDescription: string;
  expectedState?: string;
}): { system: string; user: string } {
  const system = `あなたは現場改善の効果測定の専門家です。
改善の効果を客観的に測定できる指標を提案します。
必ず以下のJSON形式で出力してください：
{
  "metrics": [
    { "name": "指標名", "howToMeasure": "測り方", "baseline": "改善前の目安" },
    { "name": "指標名", "howToMeasure": "測り方", "baseline": "改善前の目安" },
    { "name": "指標名", "howToMeasure": "測り方", "baseline": "改善前の目安" }
  ]
}`;

  const user = `以下の改善カードの効果を測定するための指標を3つ提案してください。

## タイトル
${params.issueTitle}

## 説明
${params.issueDescription}

${params.expectedState ? `## 期待する状態\n${params.expectedState}` : ''}

数値や頻度など、具体的に測定できる指標を優先してください。`;

  return { system, user };
}
