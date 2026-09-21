/**
 * What a run knows once it has started: the environment it runs against and
 * the accounts it created for itself (architecture-guide.md, section 19).
 *
 * The global setup writes it once and every worker reads it, because a worker is
 * a process of its own and the accounts have to be the same in all of them. It
 * holds working passwords, so it lives in a directory git ignores, and the
 * global teardown deletes it together with the accounts.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Where the report of a run goes: results, traces, screenshots and latencies. */
export const REPORT_DIRECTORY = join(HERE, '..', '..', 'functional-report');

const STATE = join(HERE, '..', '.state', 'run.json');

export interface Surfaces {
  readonly site: string;
  readonly api: string;
  readonly mcp: string;
  readonly auth: string;
}

export interface TestAccount {
  readonly email: string;
  readonly password: string;
  /** The subscription it owns, or null for the platform administrator. */
  readonly subscriptionId: string | null;
}

export interface RunState {
  readonly runId: string;
  readonly environment: string;
  readonly region: string;
  /** The version the deploy under test serves, when the pipeline says which. */
  readonly version: string | null;
  readonly surfaces: Surfaces;
  readonly userPoolId: string;
  readonly webClientId: string;
  readonly accounts: {
    /** Owns the subscription most cases write in. */
    readonly owner: TestAccount;
    /** Owns a second subscription, which must never see the first. */
    readonly other: TestAccount;
    /** Operates the platform, and holds no subscription at all. */
    readonly admin: TestAccount;
  };
}

export function writeState(state: RunState): void {
  mkdirSync(dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify(state, null, 2));
}

export function readState(): RunState {
  return JSON.parse(readFileSync(STATE, 'utf8')) as RunState;
}

export function forgetState(): void {
  rmSync(STATE, { force: true });
}
