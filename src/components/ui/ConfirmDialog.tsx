'use client';

import React, { useEffect, useRef, useId, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  title: string;
  description: string;
  whatHappens: string[];
  confirmLabel: string;
  confirmColor?: 'blue' | 'green' | 'red';
  isLoading?: boolean;
  /** 判断理由の入力欄を表示する */
  reason?: 'none' | 'optional' | 'required';
  reasonLabel?: string;
  reasonPlaceholder?: string;
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
  reason = 'none',
  reasonLabel = '判断理由',
  reasonPlaceholder = '承認した理由・前提条件・参考にした資料など',
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const reasonErrorId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonError, setReasonError] = useState(false);

  useModalA11y(isOpen, onCancel, !isLoading);

  // 破壊的操作を誤実行しないようキャンセル側へ初期フォーカス
  useEffect(() => {
    if (isOpen) {
      cancelButtonRef.current?.focus();
      setReasonText('');
      setReasonError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const trimmed = reasonText.trim();
    if (reason === 'required' && !trimmed) {
      setReasonError(true);
      return;
    }
    onConfirm(reason === 'none' ? undefined : trimmed || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={isLoading ? undefined : onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 animate-fade-in"
      >
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
          <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 pr-8">
            {title}
          </h3>
          <p id={descriptionId} className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            {description}
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
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

          {reason !== 'none' && (
            <div className="mb-4">
              <label
                htmlFor={reasonId}
                className="block text-sm font-medium text-gray-800 dark:text-gray-100 mb-1"
              >
                {reasonLabel}
                {reason === 'required' && (
                  <span className="text-red-600 dark:text-red-400 ml-1" aria-hidden="true">
                    *
                  </span>
                )}
                {reason === 'optional' && (
                  <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">(任意)</span>
                )}
                <span className="sr-only">{reason === 'required' ? '（必須）' : '（任意）'}</span>
              </label>
              <textarea
                id={reasonId}
                rows={3}
                required={reason === 'required'}
                aria-required={reason === 'required'}
                aria-invalid={reasonError}
                aria-describedby={reasonError ? reasonErrorId : undefined}
                value={reasonText}
                onChange={e => {
                  setReasonText(e.target.value);
                  if (reasonError) setReasonError(false);
                }}
                placeholder={reasonPlaceholder}
                disabled={isLoading}
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 resize-y ${reasonError ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
              />
              {reasonError && (
                <p
                  id={reasonErrorId}
                  role="alert"
                  className="mt-1 text-sm text-red-700 dark:text-red-300 font-medium"
                >
                  {reasonLabel}を入力してください
                </p>
              )}
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                入力内容は監査ログに残り、後から検索できます
              </p>
            </div>
          )}
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
              onClick={handleConfirm}
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
