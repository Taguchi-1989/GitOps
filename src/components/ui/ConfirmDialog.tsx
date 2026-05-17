/**
 * FlowOps - Confirm Dialog Component
 *
 * 操作前に「この操作で何が起きるか」を平易に表示する確認ダイアログ。
 * ITリテラシーの低いユーザーでも安心して操作できるよう、
 * 結果を箇条書きで分かりやすく提示する。
 *
 * アクセシビリティ:
 * - role="dialog" aria-modal="true" でモーダル属性を明示
 * - Escapeキーで閉じる
 * - 開いた時にキャンセルボタンへフォーカスを移動（破壊的操作の誤実行を防止）
 * - 閉じた時は呼び出し元へフォーカスを戻す
 */

'use client';

import React, { useEffect, useRef, useId } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  whatHappens: string[];
  confirmLabel: string;
  confirmColor?: 'blue' | 'green' | 'red';
  isLoading?: boolean;
}

const colorMap = {
  blue: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-400',
  green: 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-400',
  red: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-400',
};

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  whatHappens,
  confirmLabel,
  confirmColor = 'blue',
  isLoading = false,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // モーダルが開いた時、現在のフォーカス要素を覚えておきキャンセルボタンへ移動
  // 閉じた時に元の要素へフォーカスを戻す（キーボードユーザーの操作位置が失われない）
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    cancelButtonRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  // Escapeキーで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  // モーダル表示中は背景のスクロールを止める
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={isLoading ? undefined : onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 animate-fade-in"
      >
        {/* Close button */}
        <button
          type="button"
          ref={cancelButtonRef}
          onClick={onCancel}
          disabled={isLoading}
          aria-label="ダイアログを閉じる"
          className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="p-6">
          {/* Title */}
          <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 pr-8">
            {title}
          </h3>
          <p id={descriptionId} className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            {description}
          </p>

          {/* What happens */}
          <div
            className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6"
            role="region"
            aria-label="この操作の結果"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle
                className="w-4 h-4 text-blue-700 dark:text-blue-300"
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                この操作で何が起きるか
              </span>
            </div>
            <ul className="space-y-1.5">
              {whatHappens.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-blue-900 dark:text-blue-200"
                >
                  <span className="text-blue-500 dark:text-blue-400 mt-0.5" aria-hidden="true">
                    •
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2.5 min-h-11 text-sm font-medium text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              aria-busy={isLoading}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 min-h-11 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${colorMap[confirmColor]}`}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {isLoading ? '処理中...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
