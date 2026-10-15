/**
 * Every function starts: its bundle, made as the construct makes it, parses
 * as a module (#263).
 *
 * A function that cannot parse fails at its first invocation and at no point
 * before — not in synth, not in a test of its source — which is how the
 * renderer of prints reached staging declaring `createRequire` twice and never
 * made a file. Bundling each handler with the banner the construct prepends,
 * and asking Node to parse the result, is the earliest place that shows.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, describe, expect, it } from 'vitest';
import { LAMBDA_BANNER } from '../constructs/service-lambda.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = mkdtempSync(join(tmpdir(), 'bundles-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

const HANDLERS = [
  'memorysmithapp-backend/apps/core-monolith/src/handler.ts',
  'memorysmithapp-backend/apps/core-monolith/src/relay.handler.ts',
  'memorysmithapp-backend/apps/core-monolith/src/access-relay.handler.ts',
  'memorysmithapp-backend/apps/core-monolith/src/purge.handler.ts',
  'memorysmithapp-backend/apps/core-monolith/src/transfer.handler.ts',
  'memorysmithapp-backend/apps/core-monolith/src/print.handler.ts',
  'memorysmithapp-backend/services/audit/src/main/handler.ts',
  'memorysmithapp-backend/services/discovery/src/main/handler.ts',
  // The connector, which answers an image now (#260).
  'memorysmithapp-backend/services/agent/src/lambda.ts',
  // The two triggers of the user pool, which log through Powertools now (#269).
  'memorysmithapp-backend/services/access/src/adapters/inbound/pre-token-generation.ts',
  'memorysmithapp-backend/services/access/src/adapters/inbound/custom-message.ts',
];

describe('every function, bundled as it is deployed', () => {
  it.each(HANDLERS)(
    'parses as a module: %s',
    async (entry) => {
      const outfile = join(out, `${entry.replace(/[/.]/g, '_')}.mjs`);
      await build({
        entryPoints: [join(root, entry)],
        bundle: true,
        platform: 'node',
        format: 'esm',
        target: 'node22',
        outfile,
        banner: { js: LAMBDA_BANNER },
        // As the agent stack declares it: Mermaid is never loaded there (#291).
        ...(entry.includes('services/agent/') ? { external: ['mermaid'] } : {}),
        logLevel: 'silent',
      });
      expect(() =>
        execFileSync(process.execPath, ['--check', outfile], { stdio: 'pipe' }),
      ).not.toThrow();
    },
    60_000,
  );
});
