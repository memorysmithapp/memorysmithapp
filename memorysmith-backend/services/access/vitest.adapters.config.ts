import { defineConfig } from 'vitest/config';

/** Adapter tests against the real DynamoDB of a deployed environment, run by the staging pipeline. */
export default defineConfig({
  test: {
    include: ['test/adapters/**/*.adapter.test.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
