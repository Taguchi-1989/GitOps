'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
      <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        エラーが発生しました
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4 text-center max-w-md">
        {error.message || '予期しないエラーが発生しました。'}
      </p>
      {error.digest && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 font-mono">
          エラーID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        再試行
      </button>
    </div>
  );
}
