/**
 * FlowOps - Display Mode Context
 *
 * 「詳細モード（技術情報を表示）」のON/OFF状態を管理するContext。
 * デフォルトはOFF（＝簡単な表示）で、ONにすると
 * Git用語・JSON Patch・ベースハッシュ等の技術詳細が表示される。
 *
 * 旧「かんたんモード」からの反転:
 *   旧 flowops-simple-mode === 'false'（かんたんモードOFF＝技術者向け表示）だった利用者のみ
 *   詳細モードONへ移行し、それ以外（未設定 / 'true'）は詳細モードOFFで始まる。
 */

'use client';

import React, { createContext, useContext, useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'flowops-tech-mode';
/** 旧「かんたんモード」のキー（移行判定にのみ使用） */
const LEGACY_STORAGE_KEY = 'flowops-simple-mode';
const CHANGE_EVENT = 'flowops-tech-mode-change';

interface DisplayModeContextValue {
  /** 技術情報を表示するか */
  isTechMode: boolean;
  toggleTechMode: () => void;
  /** isTechMode の反転。簡単表示かどうかの判定に使う */
  isSimpleMode: boolean;
}

const DisplayModeContext = createContext<DisplayModeContextValue | null>(null);

export function useDisplayMode(): DisplayModeContextValue {
  const context = useContext(DisplayModeContext);
  if (!context) {
    throw new Error('useDisplayMode must be used within a DisplayModeProvider');
  }
  return context;
}

function getTechModeSnapshot(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    // 旧「かんたんモード」利用者の移行: 明示的にOFFにしていた人だけ詳細モードON
    return localStorage.getItem(LEGACY_STORAGE_KEY) === 'false';
  } catch {
    return false;
  }
}

function subscribeTechMode(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function DisplayModeProvider({ children }: { children: React.ReactNode }) {
  const isTechMode = useSyncExternalStore(subscribeTechMode, getTechModeSnapshot, () => false);

  const toggleTechMode = useCallback(() => {
    const next = !getTechModeSnapshot();
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, []);

  return (
    <DisplayModeContext.Provider value={{ isTechMode, toggleTechMode, isSimpleMode: !isTechMode }}>
      {children}
    </DisplayModeContext.Provider>
  );
}
