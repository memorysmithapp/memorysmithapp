import { defineConfig } from 'vitest/config';

/**
 * Adapter tests against the real DynamoDB and S3 of a deployed environment,
 * which the staging pipeline runs after the deploy (test/adapters/harness.ts).
 * They run sequentially: two of them assert on contention, and running them
 * side by side would have them contend with each other instead.
 */
export default defineConfig({
  test: {
    include: ['test/adapters/**/*.adapter.test.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
