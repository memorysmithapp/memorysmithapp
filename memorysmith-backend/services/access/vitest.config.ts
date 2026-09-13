import { defineConfig } from 'vitest/config';

/**
 * Unit and use-case tests: no I/O. The adapter tests live in their own
 * config because they need the tables of a deployed environment.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/adapters/**'],
  },
});
