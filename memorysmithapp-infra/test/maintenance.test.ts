/**
 * The maintenance jobs (architecture-guide.md, sections 10.3 and 11): every
 * job names an entrypoint of the core that exists, every variable that
 * entrypoint requires is one the command provides, and the tables it names are
 * the ones the data stack creates.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  accountRefusal,
  environmentRefusal,
  jobVariables,
  MAINTENANCE_JOBS,
  progressLine,
  runExitCode,
  summaryLines,
  type ReprojectionSummary,
} from '../commands/lib/maintenance.js';
import { REPOSITORY_ROOT } from '../commands/lib/repository.js';
import { physicalName } from '../config/environments.js';

describe('a maintenance job', () => {
  it('is an entrypoint of the core, and receives every variable it requires', () => {
    const provided = Object.keys(
      jobVariables({ environment: 'staging', contentBucket: 'b', userPoolId: 'p' }),
    );
    for (const job of Object.values(MAINTENANCE_JOBS)) {
      if (!('entry' in job)) continue;
      const path = join(REPOSITORY_ROOT, job.entry);
      expect(existsSync(path)).toBe(true);
      const required = [...readFileSync(path, 'utf8').matchAll(/required\('([A-Z_]+)'\)/g)].map(
        (match) => match[1],
      );
      expect(required).not.toHaveLength(0);
      for (const variable of required) expect(provided).toContain(variable);
    }
  });

  it('that runs in AWS names the state machine the projections stack creates (#311)', () => {
    const job = MAINTENANCE_JOBS['reproject-links'];
    expect('entry' in job).toBe(false);
    const stack = readFileSync(
      join(REPOSITORY_ROOT, 'memorysmithapp-infra/stacks/projections.stack.ts'),
      'utf8',
    );
    expect(stack).toContain(`physicalName(props.environment, '${job.stateMachine}')`);
  });

  it('names the tables the data stack creates for the environment', () => {
    expect(
      jobVariables({
        environment: 'production',
        contentBucket: 'the-bucket',
        userPoolId: 'the-pool',
      }),
    ).toEqual({
      ENVIRONMENT: 'production',
      KNOWLEDGE_TABLE: physicalName({ name: 'production' }, 'mv-knowledge'),
      DISCOVERY_TABLE: physicalName({ name: 'production' }, 'mv-discovery'),
      AUDIT_TABLE: physicalName({ name: 'production' }, 'mv-audit'),
      PORTABILITY_TABLE: physicalName({ name: 'production' }, 'mv-portability'),
      ACCESS_TABLE: physicalName({ name: 'production' }, 'mv-access'),
      CONTENT_BUCKET: 'the-bucket',
      USER_POOL_ID: 'the-pool',
    });
  });

  it('that cleans staging up is refused on production, before anything is read (#276)', () => {
    const cleanup = MAINTENANCE_JOBS['cleanup-staging'];
    expect(environmentRefusal(cleanup, 'production')).toBe(
      'This job runs on staging only, and never on production. Nothing ran.',
    );
    expect(environmentRefusal(cleanup, 'staging')).toBeNull();
    // The jobs that rebuild a projection run wherever they are needed.
    expect(environmentRefusal(MAINTENANCE_JOBS['reproject-links'], 'production')).toBeNull();
    // It comes first, because it is what makes a scan of staging worth running.
    expect(Object.keys(MAINTENANCE_JOBS)[0]).toBe('cleanup-staging');
  });

  it('runs only under the account the environment lives in', () => {
    expect(
      accountRefusal({
        environment: 'production',
        callerAccount: '222222222222',
        environmentAccount: '111111111111',
      }),
    ).toBe(
      'These credentials belong to account 222222222222, and production lives in 111111111111. Nothing ran.',
    );
    expect(
      accountRefusal({
        environment: 'staging',
        callerAccount: '222222222222',
        environmentAccount: '',
      }),
    ).toBe('cdk.json names no account for staging. Nothing ran.');
    expect(
      accountRefusal({
        environment: 'production',
        callerAccount: '111111111111',
        environmentAccount: '111111111111',
      }),
    ).toBeNull();
  });
});

describe('the report of a reprojection run (#311)', () => {
  const summary: ReprojectionSummary = {
    mode: 'report',
    notebooks: 3,
    rebuilt: 2,
    gone: 0,
    notes: 40,
    files: 2,
    edgesBefore: 10,
    edgesAfter: 11,
    gained: 1,
    gainedByAlias: 1,
    lost: 0,
    pending: 4,
    changed: [{ subscriptionId: 'sub', notebookId: 'nb1', gained: 1, lost: 0 }],
    lostEdges: [],
    failed: [{ subscriptionId: 'sub', notebookId: 'nb3', error: 'NoSuchVersion' }],
    good: false,
  };

  it('names where the graph changes and which notebook failed, by identifier only', () => {
    const report = summaryLines(summary).join('\n');
    expect(report).toContain('edges gained          1 (1 answered by an alias)');
    expect(report).toContain('sub / nb1  +1 -0');
    expect(report).toContain('NOTEBOOKS THAT FAILED after their retries, the others finished:');
    expect(report).toContain('sub / nb3  NoSuchVersion');
    expect(report).toContain('A report: nothing was written.');
  });

  it('exits 2 when an edge was lost, 1 when a notebook failed or no summary came back', () => {
    expect(runExitCode({ ...summary, failed: [], good: true })).toBe(0);
    expect(runExitCode(summary)).toBe(1);
    expect(runExitCode({ ...summary, failed: [], lost: 1 })).toBe(2);
    expect(runExitCode(null)).toBe(1);
  });

  it('counts what is done while it runs', () => {
    expect(progressLine({ total: 707, succeeded: 300, failed: 1, running: 20 })).toBe(
      '  301/707 notebook(s) done, 20 running',
    );
  });
});
