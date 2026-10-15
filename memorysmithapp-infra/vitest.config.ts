import { defineConfig } from 'vitest/config';

/**
 * The first synth of a test loads the whole of aws-cdk-lib, which takes longer
 * than the default five seconds on a cold machine. What the cases assert is a
 * template, never a duration.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
