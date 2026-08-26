import { defineConfig } from 'vitest/config';

/**
 * Adapter tests against DynamoDB Local and MinIO (docker compose up -d).
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
