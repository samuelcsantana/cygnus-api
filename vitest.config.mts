import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
      // Include unimported modules; generated Prisma code is not authored source.
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', '**/*.d.ts'],
      // A floor, one point under what the suite measured when it was set (lines 98.1, statements
      // 97.9, functions 98.5, branches 93.7), so a change that drops coverage fails CI instead of
      // shifting a badge nobody watches. The missing lines are mostly src/main.ts, the process
      // bootstrap (listen, signal handlers, exit), which only a running server exercises.
      thresholds: { lines: 97, statements: 97, functions: 97, branches: 92 },
    },
    include: ['tests/**/*.spec.ts'],
    hookTimeout: 20000,
    testTimeout: 20000,
    // Integration tests share one Postgres database; running spec files in
    // parallel lets one file's cleanup (e.g. deleteMany) race another file's
    // in-flight writes and trip foreign key constraints.
    fileParallelism: false,
  },
});
