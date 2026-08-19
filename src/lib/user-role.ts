/**
 * FlowOps - 利用者ロールの判定（純粋関数）
 *
 * 正本はサーバ側（proxy.ts が書き込みAPIを admin/editor に限定する）。
 * ここはその規則を画面に写して、「押しても403になるボタン」を
 * そもそも見せないためのもの。権限チェックの代わりではない。
 */

export type UserRole = 'admin' | 'editor' | 'viewer';

const KNOWN_ROLES: readonly UserRole[] = ['admin', 'editor', 'viewer'];

/**
 * セッションのロール文字列を既知のロールに正規化する。
 * 未知・未設定は proxy.ts と同じく最小権限（viewer）に倒す。
 */
export function normalizeRole(raw: unknown): UserRole {
  return KNOWN_ROLES.includes(raw as UserRole) ? (raw as UserRole) : 'viewer';
}

/** 書き込み操作（作成・編集・承認）ができるロールか。proxy.ts の WRITE_ROLES と一致させること */
export function canWrite(role: UserRole): boolean {
  return role === 'admin' || role === 'editor';
}

/** 管理者向け機能（監査ログ・AIMS証拠）を使えるロールか */
export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}

/** 画面に出すロール名（利用者に権限の理由を説明するため） */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理者',
  editor: '編集できる人',
  viewer: '閲覧のみ',
};
