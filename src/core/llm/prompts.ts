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
}): string {
  const { issueTitle, issueDescription, flowYaml, roles = [], systems = [] } = params;

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
}): { system: string; user: string } {
  return {
    system: SYSTEM_PROMPT + CONSTRAINTS_PROMPT,
    user: generateUserPrompt(params),
  };
}
