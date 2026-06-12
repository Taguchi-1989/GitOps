/**
 * FlowOps - 日付フォーマット共通ユーティリティ
 *
 * 各コンポーネントで重複定義されていた formatDate を集約。
 * 一覧・カード系は formatDate、詳細画面など年が必要な場面は formatDateWithYear を使う。
 */

function toDate(date: Date | string): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

/** 「6月13日 09:30」形式（年なし・一覧向け） */
export function formatDate(date: Date | string): string {
  return toDate(date).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 「2026年6月13日 09:30」形式（年あり・詳細画面向け） */
export function formatDateWithYear(date: Date | string): string {
  return toDate(date).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
