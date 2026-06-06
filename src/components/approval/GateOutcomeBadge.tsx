/**
 * FlowOps - Gate Outcome Badge
 *
 * Gate評価結果（outcome）を色分けして表示するバッジ
 */

import React from 'react';

export type GateOutcome = 'go' | 'revise' | 'hold' | 'stop' | 'watch';

interface GateOutcomeBadgeProps {
  outcome: GateOutcome;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const outcomeConfig: Record<
  GateOutcome,
  { label: string; sublabel: string; color: string; bg: string; emoji: string }
> = {
  go: {
    label: '進行可',
    sublabel: 'go',
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    emoji: '✅',
  },
  revise: {
    label: '要是正',
    sublabel: 'revise',
    color: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    emoji: '⚠️',
  },
  hold: {
    label: '保留',
    sublabel: 'hold',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    emoji: '⏸️',
  },
  stop: {
    label: '停止',
    sublabel: 'stop',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    emoji: '🛑',
  },
  watch: {
    label: '要観察',
    sublabel: 'watch',
    color: 'text-gray-700 dark:text-gray-300',
    bg: 'bg-gray-100 dark:bg-gray-700',
    emoji: '👁️',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function GateOutcomeBadge({ outcome, size = 'md', className = '' }: GateOutcomeBadgeProps) {
  const config = outcomeConfig[outcome];

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${config.bg} ${config.color} ${sizeClasses[size]} ${className}
      `}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
      <span className="opacity-60 text-xs">({config.sublabel})</span>
    </span>
  );
}
