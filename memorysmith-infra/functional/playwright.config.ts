/**
 * The functional suite of the product, against a deployed environment
 * (architecture-guide.md, section 19).
 *
 *   FUNCTIONAL_ENVIRONMENT=staging FUNCTIONAL_VERSION=<served> pnpm -C memorysmith-infra functional
 *
 * It runs in the Functional stage of the staging pipeline, with credentials of
 * the account, and from a workstation only to debug a case. Workers are
 * bounded because every call lands on Lambda, whose concurrency in a young
 * account is a quota the suite must not depend on.
 */

import { defineConfig } from '@playwright/test';
import type { WebOptions } from './web/fixtures.js';

export default defineConfig<WebOptions>({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: '../functional-report/artifacts',
  globalSetup: './support/global-setup.ts',
  globalTeardown: './support/global-teardown.ts',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 2,
  retries: 0,
  forbidOnly: true,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../functional-report/html', open: 'never' }],
    ['json', { outputFile: '../functional-report/results.json' }],
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'api', testDir: './api' },
    // The connector hands its tokens out through a browser flow only, once per run.
    { name: 'connector', testDir: './mcp', testMatch: '**/*.setup.ts' },
    { name: 'mcp', testDir: './mcp', dependencies: ['connector'] },
    // Every page, in each locale the interface speaks.
    { name: 'web-en_US', testDir: './web', use: { appLocale: 'en_US' } },
    { name: 'web-pt_BR', testDir: './web', use: { appLocale: 'pt_BR' } },
    { name: 'journeys', testDir: './journeys', dependencies: ['connector'] },
  ],
});
