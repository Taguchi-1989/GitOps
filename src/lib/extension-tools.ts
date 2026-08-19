/**
 * FlowOps - 拡張ツールの有効/無効（純粋関数と定義）
 *
 * DeXPI交換・BPMN交換・AIMS証拠・監査ログは、現場の改善サイクルには
 * 使わない専門ツール。初期状態では非表示にし、必要な人だけ設定画面で
 * ONにする（機能は削らず、初期表示から外すだけ）。
 */

import { NAV_LABELS } from './ui-labels';
import { isAdmin, type UserRole } from './user-role';

export type ExtensionToolKey = 'audit' | 'aims' | 'dexpi' | 'bpmn';

export interface ExtensionToolDef {
  label: string;
  /** 設定画面での説明（何をする道具なのかを専門用語なしで） */
  description: string;
  /** 管理者だけが使える道具か */
  adminOnly: boolean;
}

export const EXTENSION_TOOLS: Record<ExtensionToolKey, ExtensionToolDef> = {
  audit: {
    label: NAV_LABELS.audit,
    description: '誰がいつ何をしたかの記録を見る・書き出す。監査や報告のときに使います。',
    adminOnly: true,
  },
  aims: {
    label: NAV_LABELS.aims,
    description: 'AIマネジメントシステム（ISO/IEC 42001）の証拠を集めて、複数のAIで確認します。',
    adminOnly: true,
  },
  dexpi: {
    label: NAV_LABELS.dexpi,
    description: 'P&ID（配管計装図）のデータを読み込み・書き出しします。プラント設計向けです。',
    adminOnly: false,
  },
  bpmn: {
    label: NAV_LABELS.bpmn,
    description: '業務プロセスを BPMN 形式で読み込み・書き出しします。他ツールとの連携用です。',
    adminOnly: false,
  },
};

export const EXTENSION_TOOL_KEYS = Object.keys(EXTENSION_TOOLS) as ExtensionToolKey[];

export type ExtensionToolState = Record<ExtensionToolKey, boolean>;

/** 初期状態は全てOFF（初見の利用者に専門ツールを見せない） */
export function defaultExtensionToolState(): ExtensionToolState {
  return { audit: false, aims: false, dexpi: false, bpmn: false };
}

/**
 * localStorage に保存された JSON を状態に戻す。
 * 壊れた値・知らないキーは黙って捨てて既定（OFF）に倒す。
 */
export function parseExtensionToolState(raw: string | null): ExtensionToolState {
  const state = defaultExtensionToolState();
  if (!raw) return state;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return state;
  }
  if (typeof parsed !== 'object' || parsed === null) return state;

  for (const key of EXTENSION_TOOL_KEYS) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value === 'boolean') state[key] = value;
  }
  return state;
}

/**
 * その道具をナビに出すか。
 * 設定でONにしていても、管理者専用の道具は管理者以外には出さない。
 */
export function isExtensionToolVisible(
  key: ExtensionToolKey,
  state: ExtensionToolState,
  role: UserRole
): boolean {
  if (!state[key]) return false;
  return EXTENSION_TOOLS[key].adminOnly ? isAdmin(role) : true;
}

/** 設定画面に並べる道具（管理者専用の道具は管理者にしか出さない） */
export function availableExtensionTools(role: UserRole): ExtensionToolKey[] {
  return EXTENSION_TOOL_KEYS.filter(key => !EXTENSION_TOOLS[key].adminOnly || isAdmin(role));
}
