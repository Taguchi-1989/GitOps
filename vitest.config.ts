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
      include: ['src/core/**', 'src/lib/**'],
      exclude: ['**/*.test.ts', '**/node_modules/**'],
      thresholds: {
        'src/core/**': {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
  },
});
