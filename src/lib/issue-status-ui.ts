/**
 * FlowOps - Issueステータス表示定義（共通）
 *
 * ラベル・配色を一元管理する。StatusBadge / ダッシュボードなど
 * ステータスを表示するすべての箇所はここを参照すること。
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
    label: 'Plan中',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    emoji: '📋',
    dot: 'bg-red-500',
  },
  triage: {
    label: 'Plan中（確認待ち）',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    emoji: '📋',
    dot: 'bg-orange-500',
  },
  'in-progress': {
    label: 'Do中',
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
    label: 'Check待ち',
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
  'merged-duplicate': {
    label: '統合済み',
    color: 'text-purple-700 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    emoji: '🔗',
    dot: 'bg-purple-500',
  },
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
