/**
 * The read-only smoke that closes a deploy (architecture-guide.md, 20).
 *
 *   pnpm -C memorysmith-infra smoke --environment production --version 0.6.0 \
 *     --site https://memorysmith.app --api https://api.memorysmith.app --mcp https://mcp.memorysmith.app
 *
 * CloudFront takes a moment to drop the entry document of the previous release,
 * so a disagreement is asked again, for up to five minutes, before it fails.
 */

import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { smokeProblems, type SurfaceAnswers } from './lib/smoke.js';

const { values } = parseArgs({
  options: {
    environment: { type: 'string' },
    version: { type: 'string' },
    site: { type: 'string' },
    api: { type: 'string' },
    mcp: { type: 'string' },
  },
});

for (const name of ['environment', 'version', 'site', 'api', 'mcp'] as const) {
  if (!values[name]) {
    console.error(`smoke needs --${name}.`);
    process.exit(1);
  }
}
const expected = { environment: values.environment!, version: values.version! };
const origin = (value: string): string => value.replace(/\/$/, '');

async function json(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function collect(): Promise<SurfaceAnswers> {
  const api = await fetch(`${origin(values.api!)}/health`, { cache: 'no-store' });
  const site = await fetch(`${origin(values.site!)}/config.json`, { cache: 'no-store' });
  const mcp = await fetch(`${origin(values.mcp!)}/mcp`, { method: 'POST' });
  return {
    api: {
      status: api.status,
      body: await json(api),
      version: api.headers.get('x-memorysmith-version'),
    },
    site: { status: site.status, body: await json(site) },
    mcp: {
      status: mcp.status,
      challenge: mcp.headers.get('www-authenticate'),
      version: mcp.headers.get('x-memorysmith-version'),
    },
  };
}

const deadline = Date.now() + 5 * 60 * 1000;
let problems: string[];
do {
  try {
    problems = smokeProblems(expected, await collect());
  } catch (error) {
    problems = [
      `A surface could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  if (problems.length === 0) break;
  console.error(`Not yet: ${problems.join(' ')}`);
  await sleep(15_000);
} while (Date.now() < deadline);

if (problems.length > 0) {
  console.error(
    `The deploy of ${expected.version} to ${expected.environment} is not what is served:`,
  );
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
process.stdout.write(`Every surface serves ${expected.version} in ${expected.environment}.\n`);
