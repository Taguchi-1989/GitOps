/**
 * FlowOps - AIヘルプ（自然文の質問）の型
 *
 * POST /api/help/ask のレスポンスと、AskAI コンポーネントの共通定義。
 */

/** 回答の根拠にしたヘルプ記事 */
export interface HelpAskSource {
  slug: string;
  title: string;
  /** 記事に紐づく画面のパス（例: /issues） */
  screens: string[];
}

/**
 * POST /api/help/ask のレスポンス本体
 * answer が null のときはLLM未設定・呼び出し失敗で、記事だけを返している
 */
export interface HelpAskResult {
  answer: string | null;
  sources: HelpAskSource[];
}
