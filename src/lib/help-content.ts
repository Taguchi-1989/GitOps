/**
 * FlowOps - ヘルプ記事の読み込みと検索
 *
 * src/content/help/*.md をサーバ側で読み込み、タイトル・キーワード・本文から
 * 部分一致で検索する。形態素解析やインデックス構築は行わない（記事数が少なく、
 * 全件走査で十分速いため）。
 */

import fs from 'fs';
import path from 'path';

/** ヘルプ記事1件 */
export interface HelpArticle {
  /** ファイル名から作る識別子（例: getting-started） */
  slug: string;
  title: string;
  /** 検索用キーワード */
  keywords: string[];
  /** 関連する画面のパス（例: /flows） */
  screens: string[];
  /** frontmatter を除いた Markdown 本文 */
  body: string;
}

/** 検索ヒット1件 */
export interface HelpHit {
  slug: string;
  title: string;
  /** ヒット箇所周辺の抜粋 */
  excerpt: string;
  /** 大きいほど関連度が高い */
  score: number;
}

const HELP_DIR = path.join(process.cwd(), 'src', 'content', 'help');

/** frontmatter のカンマ区切り値をリストにする */
function parseList(value: string): string[] {
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

/**
 * `---` で囲まれた frontmatter を key: value として読む。
 * 値はすべて1行のスカラーかカンマ区切りリストなので、YAMLパーサは使わない。
 */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { meta: {}, body: normalized.trim() };
  }

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  return { meta, body: normalized.slice(match[0].length).trim() };
}

let cachedArticles: HelpArticle[] | null = null;

/**
 * ヘルプ記事を全件読み込む。
 * 本番では記事がビルド後に変わらないためプロセス内でキャッシュする。
 * 開発時は .md の編集を即反映させたいのでキャッシュしない。
 * 読み込みに失敗したときもキャッシュしない（配置ミスを永続化させない）。
 */
export function getHelpArticles(): HelpArticle[] {
  const useCache = process.env.NODE_ENV === 'production';
  if (useCache && cachedArticles) return cachedArticles;

  let fileNames: string[];
  try {
    fileNames = fs.readdirSync(HELP_DIR).filter(name => name.endsWith('.md'));
  } catch {
    // 記事ディレクトリが無い環境でも検索機能全体は落とさない
    return [];
  }

  const articles = fileNames.map(fileName => {
    const raw = fs.readFileSync(path.join(HELP_DIR, fileName), 'utf-8');
    const { meta, body } = parseFrontmatter(raw);
    const slug = fileName.replace(/\.md$/, '');

    return {
      slug,
      title: meta.title || slug,
      keywords: parseList(meta.keywords || ''),
      screens: parseList(meta.screens || ''),
      body,
    };
  });

  articles.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  if (useCache) cachedArticles = articles;
  return articles;
}

/** slug で1件取得 */
export function getHelpArticle(slug: string): HelpArticle | null {
  return getHelpArticles().find(article => article.slug === slug) ?? null;
}

/** ヒット位置の前後を切り出して抜粋を作る */
function buildExcerpt(body: string, query: string): string {
  const plain = body
    .replace(/[#*`>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const index = plain.toLowerCase().indexOf(query);
  if (index === -1) {
    return plain.slice(0, 80);
  }

  const start = Math.max(0, index - 30);
  const excerpt = plain.slice(start, start + 100);
  return start > 0 ? `…${excerpt}` : excerpt;
}

/**
 * ヘルプ記事をタイトル・キーワード・本文から検索する。
 * 部分一致のみ。タイトル一致 > キーワード一致 > 本文一致 の順に重みを付ける。
 */
export function searchHelp(query: string, limit = 5): HelpHit[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const hits: HelpHit[] = [];

  for (const article of getHelpArticles()) {
    let score = 0;
    if (article.title.toLowerCase().includes(normalized)) score += 10;
    if (article.keywords.some(keyword => keyword.toLowerCase().includes(normalized))) score += 5;
    if (article.body.toLowerCase().includes(normalized)) score += 1;

    if (score > 0) {
      hits.push({
        slug: article.slug,
        title: article.title,
        excerpt: buildExcerpt(article.body, normalized),
        score,
      });
    }
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ja'));
  return hits.slice(0, limit);
}
