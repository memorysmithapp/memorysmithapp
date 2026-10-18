import { defineConfig } from 'vitest/config';

/**
 * The operation lines every request writes stay out of the output of a run;
 * the test that reads them turns them back on.
 */
export default defineConfig({
  test: {
    env: { POWERTOOLS_LOG_LEVEL: 'SILENT' },
  },
});
