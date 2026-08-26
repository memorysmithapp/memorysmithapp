import { defineConfig } from 'vitest/config';

/**
 * Unit and use-case tests: no I/O, no container. The adapter tests live in
 * their own config because they need DynamoDB Local and MinIO up.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/adapters/**'],
  },
});
