/**
 * FlowOps - AIヘルプ（自然文で聞ける窓）
 *
 * 質問を POST /api/help/ask に送り、ヘルプ記事を根拠にした回答を表示する。
 * LLMが未設定・失敗のときは回答が null で返るので、関連しそうな記事だけを出す。
 * グローバル検索のモーダル内と /help ページの両方で使う。
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircleQuestion, BookOpen, ArrowLeft } from 'lucide-react';
import { useDisplayMode } from '@/lib/simple-mode-context';
import type { HelpAskResult } from '@/core/types/help';

/** 回答を待つ上限。これを超えたら記事フォールバック表示に切り替える */
const ASK_TIMEOUT_MS = 20_000;

interface AskAIAnswerProps {
  question: string;
  /** 質問時に開いていた画面。関連記事の絞り込みに使う */
  currentPath?: string;
  /** 「検索に戻る」を出す場合のハンドラ */
  onBack?: () => void;
  /** リンクを押したときの後処理（モーダルを閉じる等） */
  onNavigate?: () => void;
}

/** 質問1件に対する回答ビュー。マウント時に問い合わせる */
export function AskAIAnswer({ question, currentPath, onBack, onNavigate }: AskAIAnswerProps) {
  const { isTechMode } = useDisplayMode();
  const [result, setResult] = useState<HelpAskResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 質問1件につき1回だけ問い合わせる（質問が変わるときは key で作り直す）
  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/help/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, currentPath }),
      // サーバ側は15秒で打ち切るので、少し余裕を持たせた20秒で画面側も諦める。
      // タイムアウトしても catch で記事フォールバック表示に落ちる。
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(ASK_TIMEOUT_MS)]),
    })
      .then(res => res.json())
      .then((body: { ok: boolean; data?: HelpAskResult }) => {
        setResult(body.ok && body.data ? body.data : { answer: null, sources: [] });
      })
      .catch(() => {
        // 通信失敗でも画面は保つ（記事なしのフォールバック表示になる）
        setResult({ answer: null, sources: [] });
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [question, currentPath]);

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        <MessageCircleQuestion className="mr-1 inline h-4 w-4 text-blue-600 dark:text-blue-400" />
        {question}
      </p>

      {isLoading || !result ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">ヘルプを調べています...</p>
      ) : (
        <>
          {result.answer ? (
            <p className="whitespace-pre-wrap rounded-lg bg-blue-50 p-3 text-sm text-gray-800 dark:bg-blue-900/30 dark:text-gray-100">
              {result.answer}
            </p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {result.sources.length > 0
                ? '関連しそうなヘルプはこちらです。'
                : 'ぴったりのヘルプが見つかりませんでした。言葉を変えて聞いてみてください。'}
            </p>
          )}

          {result.sources.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                関連ページ
              </p>
              <ul className="space-y-2">
                {result.sources.map(source => (
                  <li key={source.slug}>
                    <Link
                      href={`/help?a=${source.slug}`}
                      onClick={onNavigate}
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <BookOpen className="h-4 w-4" />
                      {source.title}
                    </Link>
                    {source.screens.length > 0 && (
                      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                        {source.screens.map(screen => (
                          <Link
                            key={screen}
                            href={screen}
                            onClick={onNavigate}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                          >
                            {screen}
                          </Link>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.answer === null && isTechMode && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              AI回答は管理者がLLM設定を行うと利用できます。
            </p>
          )}
        </>
      )}

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          検索に戻る
        </button>
      )}
    </div>
  );
}

/** 質問入力欄つきのヘルプ窓。/help ページの上部で使う */
export function AskAIBox() {
  const pathname = usePathname();
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState<string | null>(null);

  if (question) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <AskAIAnswer key={question} question={question} currentPath={pathname} />
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => setQuestion(null)}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            別の質問をする
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const trimmed = input.trim();
        if (trimmed.length >= 2) setQuestion(trimmed);
      }}
      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row dark:border-gray-700 dark:bg-gray-800"
    >
      <label htmlFor="ask-ai-input" className="sr-only">
        ヘルプに質問する
      </label>
      <input
        id="ask-ai-input"
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="やりたいことを文章で聞いてください（例: 改善案ってどうやって出すの）"
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
      />
      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        disabled={input.trim().length < 2}
      >
        <MessageCircleQuestion className="h-4 w-4" />
        聞いてみる
      </button>
    </form>
  );
}
