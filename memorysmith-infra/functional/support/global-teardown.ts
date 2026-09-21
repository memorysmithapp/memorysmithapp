/**
 * After every case: the accounts of the run are deleted, what the run knew is
 * forgotten, and what it measured is summarized into the report
 * (architecture-guide.md, section 19).
 *
 * The subscriptions and notebooks of the run stay in the tables. Nothing in the
 * product deletes a subscription, and staging is torn down whole.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deleteAccount } from './accounts.js';
import { summarize, type LatencyRecord } from './latencies.js';
import { forgetState, readState, REPORT_DIRECTORY } from './state.js';

export default async function globalTeardown(): Promise<void> {
  const state = readState();
  for (const account of Object.values(state.accounts)) await deleteAccount(state, account);
  forgetState();

  const lines = join(REPORT_DIRECTORY, 'latencies.jsonl');
  if (!existsSync(lines)) return;
  const records = readFileSync(lines, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LatencyRecord);
  const summary = summarize(records);
  writeFileSync(join(REPORT_DIRECTORY, 'latencies.json'), JSON.stringify(summary, null, 2));

  process.stdout.write('\nLatencies, recorded and not gated (ms)\n');
  for (const each of summary) {
    process.stdout.write(
      `  ${each.operation.padEnd(64)} n=${String(each.count).padStart(3)}  p50=${String(each.p50).padStart(5)}  p95=${String(each.p95).padStart(5)}  max=${String(each.max).padStart(5)}\n`,
    );
  }
}
