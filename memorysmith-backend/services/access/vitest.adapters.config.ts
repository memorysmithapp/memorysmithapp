import { defineConfig } from 'vitest/config';

/** Adapter tests against DynamoDB Local (docker compose up -d). */
export default defineConfig({
  test: {
    include: ['test/adapters/**/*.adapter.test.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
