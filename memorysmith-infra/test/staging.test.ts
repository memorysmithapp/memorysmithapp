/**
 * The three answers of `pnpm staging:status` (development-process.md, 8).
 */

import { describe, expect, it } from 'vitest';
import {
  describeStagingStatus,
  stagingStatusOf,
  type StagingExecution,
} from '../commands/lib/staging.js';

const HEAD = 'abc4560000000000000000000000000000000000';
const EARLIER = 'abc1230000000000000000000000000000000000';
const ON_MAIN = 'fedcba0000000000000000000000000000000000';

const run = (id: string, commit: string, status = 'Succeeded', minutes = 0): StagingExecution => ({
  id,
  status,
  commit,
  startedAt: new Date(Date.UTC(2026, 8, 20, 12, minutes)),
});

const onBranch = (commit: string): boolean => commit === EARLIER || commit === HEAD;

describe('whether the head of a branch ran on staging', () => {
  it('is validated when a successful run built exactly this commit', () => {
    const status = stagingStatusOf({ head: HEAD, executions: [run('e-2', HEAD)], onBranch });
    expect(describeStagingStatus(status)).toBe(
      'Staging validated this commit, abc4560, in execution e-2.',
    );
  });

  it('is behind when only an earlier commit of the branch was validated', () => {
    const status = stagingStatusOf({
      head: HEAD,
      executions: [run('e-1', EARLIER, 'Succeeded', 1), run('e-2', HEAD, 'Failed', 2)],
      onBranch,
    });
    expect(describeStagingStatus(status)).toBe(
      'Staging validated abc1230 in execution e-1, and the branch is at abc4560: what came after it never ran on staging.',
    );
  });

  it('never ran when the only successful runs built commits of other branches or of main', () => {
    const status = stagingStatusOf({ head: HEAD, executions: [run('e-9', ON_MAIN)], onBranch });
    expect(describeStagingStatus(status)).toBe('No commit of this branch ever ran on staging.');
  });

  it('prefers the most recent of two validated earlier commits', () => {
    const later = 'abc7890000000000000000000000000000000000';
    const status = stagingStatusOf({
      head: HEAD,
      executions: [run('e-1', EARLIER, 'Succeeded', 1), run('e-3', later, 'Succeeded', 3)],
      onBranch: (commit) => commit !== ON_MAIN,
    });
    expect(status).toEqual({ state: 'behind', executionId: 'e-3', validated: later, head: HEAD });
  });
});
