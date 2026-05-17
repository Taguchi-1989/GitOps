/**
 * FlowOps - Loading Spinner Component
 */

import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
};

export function Spinner({ size = 'md', className = '', label = '読み込み中' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" aria-label={label} className="inline-flex">
      <span
        aria-hidden="true"
        className={`
          animate-spin rounded-full border-b-transparent border-blue-600
          ${sizeClasses[size]} ${className}
        `}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = '読み込み中...' }: LoadingOverlayProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" label={message} />
        <span className="text-gray-700 dark:text-gray-200 font-medium">{message}</span>
      </div>
    </div>
  );
}
