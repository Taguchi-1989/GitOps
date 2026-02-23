import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/lib/**', 'src/app/api/**'],
      exclude: ['**/*.test.ts', '**/node_modules/**'],
      thresholds: {
        'src/core/**': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        'src/lib/**': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
