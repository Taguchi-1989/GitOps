/**
 * FlowOps - 設定ページ
 *
 * 表示の好みと拡張ツールのON/OFF。いずれもこの端末のブラウザに保存する。
 */

import { SettingsClient } from './SettingsClient';

export const metadata = {
  title: '設定 - FlowOps',
  description: '表示と拡張ツールの設定',
};

export default function SettingsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">設定</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          表示のしかたと、使う道具を選べます。設定はこの端末にだけ保存されます。
        </p>
      </div>
      <SettingsClient />
    </div>
  );
}
