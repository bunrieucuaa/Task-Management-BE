import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Set BEFORE any module loads, so config/index.ts (fail-fast on a weak/missing
    // JWT_SECRET) passes during tests. dotenv.config() does not override these.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-please-ignore-0123456789-abcdefghijklmnop',
      CORS_ORIGIN: 'http://localhost:5173',
    },
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/generated/**',
        'src/**/*.d.ts',
        'src/seeds/**',
        'src/server.ts',
      ],
      // Regression floor (a few points below current ~83%). Raise as coverage grows;
      // never set above the actual numbers or CI goes red. Enforced via `test:coverage`.
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 82,
        lines: 80,
      },
    },
  },
});
