/**
 * FlowOps - ヘルプ記事の読み込み・検索テスト
 */

import { describe, it, expect } from 'vitest';
import { getHelpArticle, getHelpArticles, searchHelp } from './help-content';

describe('getHelpArticles', () => {
  it('src/content/help の記事を frontmatter 付きで読み込む', () => {
    const articles = getHelpArticles();

    expect(articles.length).toBeGreaterThan(0);
    for (const article of articles) {
      expect(article.slug).not.toBe('');
      expect(article.title).not.toBe('');
      expect(article.keywords.length).toBeGreaterThan(0);
      // frontmatter 区切りが本文に残っていないこと
      expect(article.body.startsWith('---')).toBe(false);
    }
  });

  // 記事は実行時に process.cwd()/src/content/help から読む。配布物に src/content が
  // 含まれないと全滅して無言で 0 件になるため、「1件以上・本文あり」を明示的に守る。
  it('記事が1件以上あり、いずれも本文が空でない', () => {
    const articles = getHelpArticles();

    expect(articles.length).toBeGreaterThan(0);
    for (const article of articles) {
      expect(article.body.length).toBeGreaterThan(0);
    }
  });

  it('用語集の記事を slug で取得できる', () => {
    const article = getHelpArticle('glossary');

    expect(article).not.toBeNull();
    expect(article?.title).toBe('用語集');
  });

  it('存在しない slug では null を返す', () => {
    expect(getHelpArticle('no-such-article')).toBeNull();
  });
});

describe('searchHelp', () => {
  it('空クエリでは何も返さない', () => {
    expect(searchHelp('')).toEqual([]);
    expect(searchHelp('   ')).toEqual([]);
  });

  it('用語（ブランチ）で用語集がヒットする', () => {
    const hits = searchHelp('ブランチ');

    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some(hit => hit.slug === 'glossary')).toBe(true);
  });

  it('タイトル一致がキーワード・本文一致より上位に来る', () => {
    const hits = searchHelp('用語集');

    expect(hits[0].slug).toBe('glossary');
    expect(hits[0].score).toBeGreaterThanOrEqual(10);
  });

  it('抜粋を伴って返す', () => {
    const [hit] = searchHelp('承認');

    expect(hit.excerpt.length).toBeGreaterThan(0);
    expect(hit.excerpt).not.toContain('\n');
  });

  it('どこにも無い語ではヒット0件', () => {
    expect(searchHelp('zzzznotfoundzzzz')).toEqual([]);
  });

  it('limit で件数を絞れる', () => {
    expect(searchHelp('改善', 1).length).toBeLessThanOrEqual(1);
  });
});
