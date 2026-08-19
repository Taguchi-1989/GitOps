/**
 * FlowOps - ヘルプページ
 *
 * 記事一覧と選択中の記事を並べて表示する。記事は src/content/help/*.md が正本。
 */

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { getHelpArticle, getHelpArticles } from '@/lib/help-content';
import { AskAIBox } from '@/components/ui/AskAI';
import { HelpMarkdown } from './HelpMarkdown';

export const metadata = {
  title: 'ヘルプ - FlowOps',
  description: 'FlowOps の使い方と用語集',
};

interface PageProps {
  searchParams: Promise<{ a?: string }>;
}

export default async function HelpPage({ searchParams }: PageProps) {
  const { a } = await searchParams;
  const articles = getHelpArticles();
  const active = (a ? getHelpArticle(a) : null) ?? articles[0] ?? null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ヘルプ</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          使い方と用語の説明（{articles.length}件）
        </p>
      </div>

      {/* 記事を探す前に、そのまま文章で聞ける窓 */}
      <div className="mb-6">
        <AskAIBox />
      </div>

      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        {/* 記事一覧 */}
        <nav aria-label="ヘルプ記事">
          <ul className="space-y-1">
            {articles.map(article => {
              const isActive = active?.slug === article.slug;
              return (
                <li key={article.slug}>
                  <Link
                    href={`/help?a=${article.slug}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={`
                      flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors
                      ${
                        isActive
                          ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                      }
                    `}
                  >
                    <BookOpen className="h-4 w-4 flex-shrink-0" />
                    <span>{article.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 記事本文 */}
        <article className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          {active ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{active.title}</h2>
              {active.screens.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">関連画面:</span>
                  {active.screens.map(screen => (
                    <Link
                      key={screen}
                      href={screen}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      {screen}
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <HelpMarkdown body={active.body} />
              </div>
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">ヘルプ記事がまだありません。</p>
          )}
        </article>
      </div>
    </div>
  );
}
