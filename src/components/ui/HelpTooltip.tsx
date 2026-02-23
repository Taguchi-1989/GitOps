/**
 * FlowOps - Help Tooltip Component
 *
 * コンテキストヘルプ用のツールチップ
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
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

  useEffect(() => {
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

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible]);

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        onClick={() => setIsVisible(!isVisible)}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        type="button"
        aria-label="ヘルプ"
      >
        <HelpCircle className={iconSize} />
      </button>
      {isVisible && (
        <div
          ref={tooltipRef}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 animate-fade-in"
        >
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs whitespace-normal leading-relaxed shadow-lg">
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
              <div className="w-2 h-2 bg-gray-900 rotate-45" />
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
