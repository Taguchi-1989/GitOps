import { configDefaults, defineConfig } from 'vitest/config';
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
    exclude: [...configDefaults.exclude, '.claude/**', '.agent/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/core/**/*.ts', 'src/lib/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/node_modules/**',
        '**/.next/**',
        '**/coverage/**',
        '**/dist/**',
      ],
      thresholds: {
        'src/core/**': {
          // all:true includes currently untested integration adapters; keep a truthful floor and raise it with B-1.
          branches: 70,
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
