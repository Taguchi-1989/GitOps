'use client';

import { useEffect, useRef } from 'react';

/**
 * モーダル共通: Escapeで閉じる / 背景スクロール停止 / 元のフォーカス復元。
 */
export function useModalA11y(isOpen: boolean, onClose: () => void, enableEscape = true) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (enableEscape && e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose, enableEscape]);
}
