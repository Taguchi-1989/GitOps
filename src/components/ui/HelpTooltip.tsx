/**
 * FlowOps - Help Tooltip Component
 *
 * コンテキストヘルプ用のツールチップ
 * - マウス: ホバー/クリックで表示
 * - キーボード: Enter/Space/Tabで表示、Escapeで閉じる
 * - スクリーンリーダー: aria-describedby で内容を読み上げ
 */

'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  content: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function HelpTooltip({ content, className = '', size = 'sm' }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!isVisible) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsVisible(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible]);

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsVisible(v => !v)}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="inline-flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="ヘルプを表示"
        aria-describedby={isVisible ? tooltipId : undefined}
        aria-expanded={isVisible}
      >
        <HelpCircle className={iconSize} aria-hidden="true" />
      </button>
      {isVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 animate-fade-in"
        >
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs whitespace-normal leading-relaxed shadow-lg">
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1" aria-hidden="true">
              <div className="w-2 h-2 bg-gray-900 rotate-45" />
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
