import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      all: false,
      exclude: [
        '**/*.test.ts',
        '**/node_modules/**',
        '**/.next/**',
        '**/coverage/**',
        '**/dist/**',
      ],
      thresholds: {
        'src/core/**': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        'src/lib/**': {
          branches: 77,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
