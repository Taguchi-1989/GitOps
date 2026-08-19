/**
 * FlowOps - グローバル検索の結果型
 *
 * GET /api/search のレスポンスと、GlobalSearch コンポーネントの共通定義。
 */

/** 改善カードのヒット */
export interface IssueSearchResult {
  id: string;
  humanId: string;
  title: string;
  status: string;
}

/** フローのヒット */
export interface FlowSearchResult {
  id: string;
  title: string;
  layer: string;
}

/** ヘルプ記事のヒット */
export interface HelpSearchResult {
  slug: string;
  title: string;
  excerpt: string;
}

/** GET /api/search のレスポンス本体 */
export interface SearchResults {
  issues: IssueSearchResult[];
  flows: FlowSearchResult[];
  help: HelpSearchResult[];
}
