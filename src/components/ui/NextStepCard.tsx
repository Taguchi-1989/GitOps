/**
 * FlowOps - Next Step Card
 *
 * 「いま、次に何をすればいいか」を主要画面で常に1つだけ示すカード。
 * 色分けで意味を伝えるのではなく、押すボタン名とアイコンで指示する
 * （色が見分けにくい環境・利用者でも同じように読めるようにするため）。
 *
 * 表示のON/OFFは利用者が選べる。dismissKey を渡すと閉じた状態を
 * localStorage に覚えるので、慣れた利用者には二度と出ない。
 */

'use client';

import React, { useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Lightbulb, X, type LucideIcon } from 'lucide-react';

export interface NextStepAction {
  /** 実際の画面にあるボタン名と完全に同じ文言にすること（@/lib/ui-labels 参照） */
  label: string;
  href?: string;
  onClick?: () => void;
}

interface NextStepCardProps {
  icon: LucideIcon;
  /** 何をすればいいかを一文で。ボタン名を含める */
  title: string;
  description: string;
  /** 押すべきボタンが同じ画面にないときだけ、遷移用のボタンを出す */
  action?: NextStepAction;
  /** 押すべきボタンが同じ画面にあるときの場所の案内 */
  hint?: string;
  /**
   * 閉じた状態を記憶するキー（画面ごとに固有）。
   * 未指定のときは閉じるボタンを出さない（＝常時表示）。
   */
  dismissKey?: string;
  className?: string;
}

const STORAGE_PREFIX = 'flowops-next-step-dismissed:';
const CHANGE_EVENT = 'flowops-next-step-dismiss-change';

/** localStorage が使えない環境でも「閉じる」が効くようにするための保険（タブを閉じるまで有効） */
const sessionDismissed = new Set<string>();

/** 閉じられているか */
function readDismissed(key: string): boolean {
  if (sessionDismissed.has(key)) return true;
  try {
    return localStorage.getItem(STORAGE_PREFIX + key) === 'true';
  } catch {
    return false;
  }
}

function subscribeDismissed(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function NextStepCard({
  icon: Icon,
  title,
  description,
  action,
  hint,
  dismissKey,
  className = '',
}: NextStepCardProps) {
  // サーバ描画時は localStorage を読めない。閉じたはずのカードが一瞬出るのを
  // 避けるため、閉じられる可能性があるカードはサーバ側では非表示にしておく。
  const isDismissed = useSyncExternalStore(
    subscribeDismissed,
    useCallback(() => (dismissKey ? readDismissed(dismissKey) : false), [dismissKey]),
    useCallback(() => Boolean(dismissKey), [dismissKey])
  );

  const handleDismiss = useCallback(() => {
    if (!dismissKey) return;
    sessionDismissed.add(dismissKey);
    try {
      localStorage.setItem(STORAGE_PREFIX + dismissKey, 'true');
    } catch {
      // localStorage unavailable
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [dismissKey]);

  if (isDismissed) return null;

  return (
    <section
      aria-label="次にすること"
      className={`rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/30 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-white/70 p-2 dark:bg-gray-900/40">
          <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">次にすること</p>
          <h2 className="mt-0.5 text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>

          {hint && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {hint}
            </p>
          )}

          {action &&
            (action.href ? (
              <Link
                href={action.href}
                className="
                  mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2
                  text-sm font-medium text-white transition-colors hover:bg-blue-700
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                "
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className="
                  mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2
                  text-sm font-medium text-white transition-colors hover:bg-blue-700
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                "
              >
                {action.label}
              </button>
            ))}
        </div>

        {dismissKey && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="この案内を閉じる"
            title="この案内を閉じる"
            className="
              shrink-0 rounded p-1 text-gray-400 transition-colors
              hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}
