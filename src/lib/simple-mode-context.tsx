/**
 * FlowOps - Simple Mode Context
 *
 * 「かんたんモード」のON/OFF状態を管理するContext。
 * ON時はGit用語・JSON Patch等の技術詳細を非表示にし、
 * ITリテラシーの低いユーザーにも分かりやすいUIを提供する。
 */

'use client';

import React, { createContext, useContext, useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'flowops-simple-mode';
const CHANGE_EVENT = 'flowops-simple-mode-change';

interface SimpleModeContextValue {
  isSimpleMode: boolean;
  toggleSimpleMode: () => void;
}

const SimpleModeContext = createContext<SimpleModeContextValue | null>(null);

export function useSimpleMode(): SimpleModeContextValue {
  const context = useContext(SimpleModeContext);
  if (!context) {
    throw new Error('useSimpleMode must be used within a SimpleModeProvider');
  }
  return context;
}

function getSimpleModeSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function subscribeSimpleMode(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function SimpleModeProvider({ children }: { children: React.ReactNode }) {
  const isSimpleMode = useSyncExternalStore(
    subscribeSimpleMode,
    getSimpleModeSnapshot,
    () => false
  );

  // localStorage から初期値を読み込み
  const toggleSimpleMode = useCallback(() => {
    const next = !getSimpleModeSnapshot();
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // localStorage unavailable
    }
  }, []);

  return (
    <SimpleModeContext.Provider value={{ isSimpleMode, toggleSimpleMode }}>
      {children}
    </SimpleModeContext.Provider>
  );
}
