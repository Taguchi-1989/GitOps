/**
 * FlowOps - JSON Extraction Utility
 *
 * LLMレスポンスからJSONを確実に抽出するユーティリティ。
 * JSON mode対応・非対応プロバイダーの両方で動作する。
 */

/**
 * テキストからJSONを抽出する。
 * 1. 直接パース
 * 2. ```json ... ``` コードブロックから抽出
 * 3. 最初の { ... } ブロックから抽出
 *
 * @throws Error 抽出に失敗した場合
 */
export function extractJson(content: string): unknown {
  // そのままパースを試みる
  try {
    return JSON.parse(content);
  } catch {
    // フォールバック: ```json ... ``` ブロックを抽出
    const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // fall through
      }
    }

    // フォールバック: 最初の { ... } ブロックを抽出
    const braceMatch = content.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {
        // fall through
      }
    }

    throw new Error('Failed to extract valid JSON from text');
  }
}
