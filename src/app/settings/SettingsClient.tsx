/**
 * FlowOps - 設定画面（クライアント）
 *
 * 表示に関する設定はすべて利用者ごと（この端末のブラウザに保存）。
 * サーバ側の権限は変えられない — できることはロールで決まる。
 */

'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, RotateCcw, Wrench } from 'lucide-react';
import { useDisplayMode } from '@/lib/simple-mode-context';
import { useExtensionTools, usePermissions } from '@/lib/use-permissions';
import { availableExtensionTools, EXTENSION_TOOLS } from '@/lib/extension-tools';
import { ROLE_LABELS } from '@/lib/user-role';
import { clearDismissedNextSteps } from '@/components/ui/NextStepCard';

export function SettingsClient() {
  const { isTechMode, toggleTechMode } = useDisplayMode();
  const { role, canWrite } = usePermissions();
  const { tools, setToolEnabled } = useExtensionTools();
  const [guidesRestored, setGuidesRestored] = useState(false);

  const toolKeys = availableExtensionTools(role);

  const handleRestoreGuides = () => {
    clearDismissedNextSteps();
    setGuidesRestored(true);
    setTimeout(() => setGuidesRestored(false), 3000);
  };

  return (
    <div className="max-w-3xl space-y-8">
      {/* できること（ロール） */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          あなたにできること
        </h2>
        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            いまの権限: <span className="font-bold">{ROLE_LABELS[role]}</span>
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {canWrite
              ? 'フローの編集、改善カードの作成、承認ができます。'
              : '内容を見ることはできますが、作成・編集・承認はできません。必要な場合は管理者に権限の変更を依頼してください。'}
          </p>
        </div>
      </section>

      {/* 表示 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">表示</h2>
        <div className="mt-3 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          <label className="flex cursor-pointer items-start gap-3 p-4">
            <input
              type="checkbox"
              checked={isTechMode}
              onChange={toggleTechMode}
              className="mt-1 h-4 w-4 rounded text-blue-600"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                {isTechMode ? (
                  <Eye className="h-4 w-4 text-blue-500" />
                ) : (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                )}
                詳細モード（技術情報を表示）
              </span>
              <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
                ONにすると、ファイル名・Gitのブランチ名・変更内容のデータなど、技術者向けの情報も表示します。
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                「次にすること」の案内を出し直す
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                閉じた案内カードをすべて表示に戻します。
              </p>
            </div>
            <div className="flex items-center gap-3">
              {guidesRestored && (
                <span className="text-sm font-medium text-green-600">戻しました</span>
              )}
              <button
                type="button"
                onClick={handleRestoreGuides}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <RotateCcw className="h-4 w-4" />
                出し直す
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 拡張ツール */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <Wrench className="h-5 w-5" />
          拡張ツール
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          ふだんの改善サイクルには使わない専門ツールです。必要な人だけONにしてください。ONにするとメニューに「管理・専門ツール」として表示されます。
        </p>
        <div className="mt-3 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {toolKeys.map(key => (
            <label key={key} className="flex cursor-pointer items-start gap-3 p-4">
              <input
                type="checkbox"
                checked={tools[key]}
                onChange={e => setToolEnabled(key, e.target.checked)}
                className="mt-1 h-4 w-4 rounded text-blue-600"
              />
              <span className="min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {EXTENSION_TOOLS[key].label}
                </span>
                <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
                  {EXTENSION_TOOLS[key].description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
