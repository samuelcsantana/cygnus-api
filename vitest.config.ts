import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    hookTimeout: 20000,
    testTimeout: 20000,
    // Integration tests share one Postgres database; running spec files in
    // parallel lets one file's cleanup (e.g. deleteMany) race another file's
    // in-flight writes and trip foreign key constraints.
    fileParallelism: false,
  },
});
