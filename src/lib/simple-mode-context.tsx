/**
 * FlowOps - Simple Mode Context
 *
 * 「かんたんモード」のON/OFF状態を管理するContext。
 * ON時はGit用語・JSON Patch等の技術詳細を非表示にし、
 * ITリテラシーの低いユーザーにも分かりやすいUIを提供する。
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'flowops-simple-mode';

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

export function SimpleModeProvider({ children }: { children: React.ReactNode }) {
  const [isSimpleMode, setIsSimpleMode] = useState(false);

  // localStorage から初期値を読み込み
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setIsSimpleMode(stored === 'true');
      }
    } catch {
      // SSR or localStorage unavailable
    }
  }, []);

  const toggleSimpleMode = useCallback(() => {
    setIsSimpleMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  return (
    <SimpleModeContext.Provider value={{ isSimpleMode, toggleSimpleMode }}>
      {children}
    </SimpleModeContext.Provider>
  );
}
