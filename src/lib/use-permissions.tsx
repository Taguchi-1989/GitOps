/**
 * FlowOps - 画面側の権限・拡張ツール状態フック
 *
 * 権限の正本はサーバ（proxy.ts）。ここは「押しても403になるボタンを
 * 見せない」ためだけに使う。判定ロジックは user-role.ts / extension-tools.ts
 * （純粋関数・テスト済み）に置き、ここは React への配線に徹する。
 */

'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import { canWrite, isAdmin, normalizeRole, type UserRole } from './user-role';
import {
  defaultExtensionToolState,
  parseExtensionToolState,
  type ExtensionToolKey,
  type ExtensionToolState,
} from './extension-tools';

const STORAGE_KEY = 'flowops-extension-tools';
const CHANGE_EVENT = 'flowops-extension-tools-change';

interface Permissions {
  role: UserRole;
  /** 作成・編集・承認ができるか */
  canWrite: boolean;
  isAdmin: boolean;
}

/**
 * 現在の利用者のロール。
 *
 * セッションが無い状態でこの画面に到達できるのは AUTH_DISABLED のローカル実行のみ
 * （認証が有効なら authorized コールバックが /login に送る）。その場合は
 * proxy.ts が actorRole を 'admin' として扱うので、画面もそれに合わせる。
 * 読み込み中も同じ扱いにして、ボタンが一瞬消えてから出る動きを避ける。
 */
export function usePermissions(): Permissions {
  const { data: session, status } = useSession();

  if (status === 'loading' || !session?.user) {
    return { role: 'admin', canWrite: true, isAdmin: true };
  }

  const role = normalizeRole((session.user as { role?: string }).role);
  return { role, canWrite: canWrite(role), isAdmin: isAdmin(role) };
}

function readExtensionToolState(): ExtensionToolState {
  try {
    return parseExtensionToolState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultExtensionToolState();
  }
}

// useSyncExternalStore は getSnapshot が毎回同じ参照を返すことを要求するので、
// 読み込んだ状態をメモリに保持する。これは localStorage が使えない環境でも
// 切り替えが効くようにするための保険も兼ねる（タブを閉じるまで有効）。
let cachedState: ExtensionToolState | null = null;

function getExtensionToolSnapshot(): ExtensionToolState {
  if (cachedState === null) cachedState = readExtensionToolState();
  return cachedState;
}

function subscribeExtensionTools(callback: () => void): () => void {
  // 別タブでの変更（storage）はキャッシュを捨てて読み直す
  const handleStorage = () => {
    cachedState = null;
    callback();
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

const serverExtensionToolState = defaultExtensionToolState();

export function useExtensionTools(): {
  tools: ExtensionToolState;
  setToolEnabled: (key: ExtensionToolKey, enabled: boolean) => void;
} {
  const tools = useSyncExternalStore(
    subscribeExtensionTools,
    getExtensionToolSnapshot,
    () => serverExtensionToolState
  );

  const setToolEnabled = useCallback((key: ExtensionToolKey, enabled: boolean) => {
    const next = { ...getExtensionToolSnapshot(), [key]: enabled };
    cachedState = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage unavailable
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { tools, setToolEnabled };
}
