/**
 * FlowOps - グローバル検索
 *
 * Ctrl+K / Cmd+K またはサイドバーのボタンで開くモーダル検索。
 * 改善カード・フロー・ヘルプ記事を横断し、ステータスタブの絞り込みに影響されない。
 * 外部ライブラリは使わず、必要な操作（開閉・上下移動・Enter で遷移）だけを実装する。
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  AlertCircle,
  FileText,
  BookOpen,
  Plus,
  X,
  MessageCircleQuestion,
} from 'lucide-react';
import type { SearchResults } from '@/core/types/search';
import { NAV_LABELS } from '@/lib/ui-labels';
import { AskAIAnswer } from './AskAI';

const EMPTY_RESULTS: SearchResults = { issues: [], flows: [], help: [] };

/** 入力が落ち着いてから検索するまでの待ち時間 */
const DEBOUNCE_MS = 200;

/** これ以上入力されたら「AIに聞く」行を出す（単語1つでは質問にならないため） */
const ASK_MIN_LENGTH = 5;

interface FlatHit {
  key: string;
  href: string;
  label: string;
  sublabel?: string;
}

/** グループ表示と上下キー移動の両方で使えるように結果を平坦化する */
function flatten(results: SearchResults): FlatHit[] {
  return [
    ...results.issues.map(issue => ({
      key: `issue-${issue.id}`,
      href: `/issues/${issue.id}`,
      label: issue.title,
      sublabel: issue.humanId,
    })),
    ...results.flows.map(flow => ({
      key: `flow-${flow.id}`,
      href: `/flows/${flow.id}`,
      label: flow.title,
      sublabel: flow.layer,
    })),
    ...results.help.map(hit => ({
      key: `help-${hit.slug}`,
      href: `/help?a=${hit.slug}`,
      label: hit.title,
      sublabel: hit.excerpt,
    })),
  ];
}

export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  /** AIヘルプの回答ビューに切り替えているときの質問文 */
  const [askQuestion, setAskQuestion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** モーダル本体。キー操作の受け口とフォーカストラップの範囲を兼ねる */
  const dialogRef = useRef<HTMLDivElement>(null);
  /** 閉じたときにフォーカスを戻す先（サイドバーの検索ボタン） */
  const triggerRef = useRef<HTMLButtonElement>(null);

  const hits = useMemo(() => flatten(results), [results]);
  const hasQuery = query.trim().length > 0;
  const canAsk = query.trim().length >= ASK_MIN_LENGTH;
  /** 「AIに聞く」行のキー移動上の位置 */
  const askIndex = hits.length;

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setResults(EMPTY_RESULTS);
    setActiveIndex(0);
    setAskQuestion(null);
    // 起動ボタンにフォーカスを戻す（閉じた後にキーボード操作が迷子にならないように）
    triggerRef.current?.focus();
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  // Ctrl+K / Cmd+K で開閉
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // 回答ビューには入力欄が無いので、フォーカスはモーダル本体に移す
  // （フォーカスが body に落ちると Escape も Tab トラップも効かなくなる）
  useEffect(() => {
    if (!isOpen) return;
    if (askQuestion) {
      dialogRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [isOpen, askQuestion]);

  // 入力欄の変更。空になった時点で結果を捨てる（効果内でのsetStateを避ける）
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (value.trim()) {
      // 実際の取得はデバウンス後だが、その間も「検索中」を出して空表示のちらつきを防ぐ
      setIsLoading(true);
    } else {
      setResults(EMPTY_RESULTS);
      setIsLoading(false);
    }
  }, []);

  // 入力に応じて検索（打鍵ごとに投げない）
  useEffect(() => {
    const trimmed = query.trim();
    if (!isOpen || !trimmed) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then(res => res.json())
        .then((body: { ok: boolean; data?: SearchResults }) => {
          setResults(body.ok && body.data ? body.data : EMPTY_RESULTS);
          setActiveIndex(0);
        })
        .catch(() => {
          // 中断・通信失敗時は結果なしとして扱う（画面は開いたまま再入力できる）
        })
        .finally(() => {
          // 打鍵の合間の中断で「一致なし」が一瞬出ないよう、中断時は検索中のままにする
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, isOpen]);

  /** モーダル内でフォーカスを回すための要素一覧 */
  const getFocusable = (): HTMLElement[] => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled])'
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // 回答ビュー中は検索に戻るだけにする
      if (askQuestion) {
        setAskQuestion(null);
        return;
      }
      close();
      return;
    }

    // Tab はモーダル内で先頭↔末尾をループさせ、背景へ抜けさせない
    if (e.key === 'Tab') {
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }

    if (askQuestion) return;

    // 「AIに聞く」行がある場合は末尾の1件として一緒に回す
    const itemCount = hits.length + (canAsk ? 1 : 0);
    if (itemCount === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % itemCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + itemCount) % itemCount);
    } else if (e.key === 'Enter') {
      // ボタンにフォーカスがある場合はそのボタン自身のクリックに任せる
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      e.preventDefault();
      if (activeIndex === askIndex && canAsk) {
        setAskQuestion(query.trim());
      } else if (hits[activeIndex]) {
        go(hits[activeIndex].href);
      }
    }
  };

  const renderGroup = (
    title: string,
    icon: React.ElementType,
    groupHits: FlatHit[],
    offset: number
  ) => {
    if (groupHits.length === 0) return null;
    const Icon = icon;

    return (
      <div className="py-2">
        <p className="px-4 pb-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <ul>
          {groupHits.map((hit, index) => {
            const isActive = offset + index === activeIndex;
            return (
              <li key={hit.key}>
                <button
                  type="button"
                  onClick={() => go(hit.href)}
                  onMouseEnter={() => setActiveIndex(offset + index)}
                  className={`
                    flex w-full items-start gap-3 px-4 py-2 text-left
                    ${isActive ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
                  `}
                >
                  <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-gray-900 dark:text-gray-100">
                      {hit.label}
                    </span>
                    {hit.sublabel && (
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {hit.sublabel}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const issueHits = hits.slice(0, results.issues.length);
  const flowHits = hits.slice(results.issues.length, results.issues.length + results.flows.length);
  const helpHits = hits.slice(results.issues.length + results.flows.length);

  return (
    <>
      {/* サイドバーの検索ボタン */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
      >
        <Search className="h-4 w-4" />
        <span>検索</span>
        <kbd className="ml-auto rounded border border-gray-700 px-1.5 py-0.5 text-xs text-gray-500">
          Ctrl+K
        </kbd>
      </button>

      {!isOpen ? null : (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
          onClick={close}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="検索"
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
            // キー操作はモーダル全体で受ける（入力欄から外れても Escape / Tab が効くように）
            onKeyDown={handleKeyDown}
            className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl outline-none dark:bg-gray-800"
          >
            {/* 入力欄 */}
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <Search className="h-5 w-5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder="改善カード・フロー・ヘルプを検索"
                className="min-w-0 flex-1 bg-transparent text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={close}
                aria-label="検索を閉じる"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 結果 */}
            <div className="max-h-96 overflow-y-auto">
              {askQuestion ? (
                <AskAIAnswer
                  key={askQuestion}
                  question={askQuestion}
                  currentPath={pathname}
                  onBack={() => setAskQuestion(null)}
                  onNavigate={close}
                />
              ) : (
                <>
                  {!hasQuery ? (
                    <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      探したい言葉を入力してください
                    </p>
                  ) : isLoading && hits.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      検索中...
                    </p>
                  ) : hits.length === 0 ? (
                    <div className="space-y-3 px-4 py-6 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        「{query}」に一致するものはありませんでした
                      </p>
                      <div className="flex flex-col items-center gap-2">
                        <button
                          type="button"
                          onClick={() => go('/help')}
                          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          <BookOpen className="h-4 w-4" />
                          ヘルプで調べる
                        </button>
                        <button
                          type="button"
                          onClick={() => go('/issues/new')}
                          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4" />
                          改善カードを作る
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {renderGroup(NAV_LABELS.issues, AlertCircle, issueHits, 0)}
                      {renderGroup(NAV_LABELS.flows, FileText, flowHits, results.issues.length)}
                      {renderGroup(
                        'ヘルプ',
                        BookOpen,
                        helpHits,
                        results.issues.length + results.flows.length
                      )}
                    </>
                  )}

                  {/* 検索で見つからなくても、そのまま文章で聞ける逃げ道 */}
                  {canAsk && (
                    <div className="border-t border-gray-200 py-2 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => setAskQuestion(query.trim())}
                        onMouseEnter={() => setActiveIndex(askIndex)}
                        className={`
                          flex w-full items-start gap-3 px-4 py-2 text-left
                          ${activeIndex === askIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
                        `}
                      >
                        <MessageCircleQuestion className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                        <span className="min-w-0 truncate text-sm text-gray-900 dark:text-gray-100">
                          AIに聞く: 「{query.trim()}」
                        </span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
