/**
 * FlowOps - 改善カードのステータス表示定義（共通・正本）
 *
 * ラベル・配色を一元管理する。StatusBadge / 一覧タブ / ダッシュボードなど
 * ステータスを表示するすべての箇所はここを参照すること。
 *
 * 語彙は1系統に統一する（PDCA用語はバッジに出さず、進行図の補助表示にとどめる）:
 *   起票済み → 対応中 → 改善案あり → 効果確認中 → 完了 / 見送り / 統合済み
 */

import { IssueStatus } from '@/core/issue';

export interface StatusUiConfig {
  label: string;
  color: string;
  bg: string;
  emoji: string;
  dot: string;
}

const STATUS_UI: Record<IssueStatus, StatusUiConfig> = {
  new: {
    label: '起票済み',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    emoji: '📋',
    dot: 'bg-red-500',
  },
  triage: {
    label: '起票済み',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    emoji: '📋',
    dot: 'bg-orange-500',
  },
  'in-progress': {
    label: '対応中',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    emoji: '▶️',
    dot: 'bg-blue-500',
  },
  proposed: {
    label: '改善案あり',
    color: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    emoji: '✨',
    dot: 'bg-yellow-500',
  },
  merged: {
    label: '効果確認中',
    color: 'text-teal-700 dark:text-teal-400',
    bg: 'bg-teal-100 dark:bg-teal-900/30',
    emoji: '🔍',
    dot: 'bg-teal-500',
  },
  rejected: {
    label: '見送り',
    color: 'text-gray-700 dark:text-gray-300',
    bg: 'bg-gray-100 dark:bg-gray-700',
    emoji: '⏸️',
    dot: 'bg-gray-500',
  },
  'closed-ineffective': {
    label: '見送り（効果なし）',
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-700',
    emoji: '📉',
    dot: 'bg-slate-500',
  },
  'merged-duplicate': {
    label: '統合済み',
    color: 'text-purple-700 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    emoji: '🔗',
    dot: 'bg-purple-500',
  },
};

/** 標準化まで終わった改善カード（merged かつ standardizedAt あり）の表示 */
const STANDARDIZED_UI: StatusUiConfig = {
  label: '完了',
  color: 'text-purple-700 dark:text-purple-400',
  bg: 'bg-purple-100 dark:bg-purple-900/30',
  emoji: '⭐',
  dot: 'bg-purple-500',
};

const FALLBACK: StatusUiConfig = {
  label: '不明',
  color: 'text-gray-700 dark:text-gray-300',
  bg: 'bg-gray-100 dark:bg-gray-700',
  emoji: '❔',
  dot: 'bg-gray-400',
};

/** 未知のステータスでもクラッシュしないようフォールバック付きで返す */
export function getStatusUi(status: string): StatusUiConfig {
  return STATUS_UI[status as IssueStatus] ?? FALLBACK;
}

/** バッジ用のラベル（未知のステータスは生の値を表示） */
export function getStatusLabel(status: string): string {
  return STATUS_UI[status as IssueStatus]?.label ?? status;
}

/** バッジ用の背景+文字色クラス */
export function getStatusBadgeClass(status: string): string {
  const ui = getStatusUi(status);
  return `${ui.bg} ${ui.color}`;
}

/**
 * 標準化（Act完了）まで含めた表示定義。
 * merged かつ standardizedAt が立っていれば「完了⭐」を返す。
 */
export function getIssueDisplayUi(
  status: string,
  standardizedAt?: Date | string | null
): StatusUiConfig {
  // standardizedAt だけで判定すると、標準化後に見送り等へ変わったカードまで
  // 「完了⭐」になってしまうため status も見る（getIssueTab と同じ条件）
  if (status === 'merged' && standardizedAt) {
    return STANDARDIZED_UI;
  }
  return getStatusUi(status);
}

/** 標準化を加味したバッジラベル */
export function getIssueDisplayLabel(
  status: string,
  standardizedAt?: Date | string | null
): string {
  if (status === 'merged' && standardizedAt) {
    return STANDARDIZED_UI.label;
  }
  return getStatusLabel(status);
}

/** 標準化を加味したバッジの背景+文字色クラス */
export function getIssueDisplayBadgeClass(
  status: string,
  standardizedAt?: Date | string | null
): string {
  const ui = getIssueDisplayUi(status, standardizedAt);
  return `${ui.bg} ${ui.color}`;
}

/** 一覧タブの区分（タブとバッジで同じ語彙を使うための正本） */
export type IssueTabValue = 'open' | 'checking' | 'closed';

export const ISSUE_TAB_CONFIG: Record<IssueTabValue, { label: string }> = {
  open: { label: '起票済み・対応中' },
  checking: { label: '効果確認中' },
  closed: { label: '完了・見送り' },
};

/** 改善カードがどのタブに属するかを判定する */
export function getIssueTab(status: string, standardizedAt?: Date | string | null): IssueTabValue {
  if (status === 'merged') {
    return standardizedAt ? 'closed' : 'checking';
  }
  if (status === 'rejected' || status === 'closed-ineffective' || status === 'merged-duplicate') {
    return 'closed';
  }
  return 'open';
}
