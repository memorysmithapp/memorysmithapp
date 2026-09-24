/**
 * The parts of the functional suite that decide something without an
 * environment (architecture-guide.md, section 19): what it has to cover, how it
 * waits for a projection, and how it summarizes what it measured.
 */

import { describe, expect, it } from 'vitest';
import {
  coverageGap,
  declaredCases,
  describeGap,
  pagesOf,
} from '../functional/support/coverage.js';
import { eventually } from '../functional/support/eventually.js';
import { percentile, summarize } from '../functional/support/latencies.js';
import { readText } from '../commands/lib/repository.js';

describe('what a case declares it covers', () => {
  it('is read from the titles of the specs, by surface', () => {
    const declared = declaredCases([
      "test('[route:GET /health] answers the version', async () => {});",
      "test('[tool:create_note] writes [page:/notebooks/:notebookId/graph]', () => {});",
    ]);
    expect([...declared.route]).toEqual(['GET /health']);
    expect([...declared.tool]).toEqual(['create_note']);
    expect([...declared.page]).toEqual(['/notebooks/:notebookId/graph']);
  });

  it('fails when one case is removed, and when a case names what is gone', () => {
    const required = ['create_note', 'read_note', 'whoami'];
    expect(describeGap('tool', coverageGap(required, new Set(required)))).toBeNull();
    expect(
      describeGap('tool', coverageGap(required, new Set(['read_note', 'whoami', 'retitle']))),
    ).toBe(
      'no case covers the tool create_note\na case covers the tool retitle, which no longer exists',
    );
  });
});

describe('the pages of the interface', () => {
  it('are the leaves of the router, as full paths', () => {
    expect(pagesOf(readText('memorysmith-frontend/src/app/router.tsx'))).toEqual([
      '/login',
      '/auth/callback',
      // Outside the frame of the application, drawn as the sign-in (#214).
      '/profile/password',
      '/',
      '/about',
      '/profile',
      '/transfers',
      '/notebooks/:notebookId',
      '/notebooks/:notebookId/guidance',
      '/notebooks/:notebookId/templates',
      '/notebooks/:notebookId/graph',
      '/notebooks/:notebookId/folders/:folderId',
      '/notebooks/:notebookId/notes/:noteId',
      '/notebooks/:notebookId/links/:target',
      '/notebooks/:notebookId/*',
    ]);
  });
});

describe('waiting for a projection', () => {
  it('asks again until the answer shows the write, without sleeping past it', async () => {
    const answers = [0, 0, 2];
    const slept: number[] = [];
    const found = await eventually(
      'the note in search',
      async () => answers.shift() ?? 2,
      (hits) => hits > 0,
      { sleep: async (milliseconds) => void slept.push(milliseconds) },
    );
    expect(found).toBe(2);
    expect(slept).toEqual([1000, 1000]);
  });

  it('gives up at the target, saying what it last saw', async () => {
    let clock = 0;
    await expect(
      eventually(
        'the backlink',
        async () => ({ backlinks: [] }),
        () => false,
        {
          timeoutMs: 3_000,
          now: () => clock,
          sleep: async (milliseconds) => void (clock += milliseconds),
        },
      ),
    ).rejects.toThrow('the backlink did not happen within 3 s. Last seen: {"backlinks":[]}');
  });
});

describe('what a run measured', () => {
  it('is summarized per operation with values that were measured', () => {
    expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 95)).toBe(100);
    expect(percentile([10, 20, 30, 40], 50)).toBe(20);
    expect(
      summarize([
        { operation: 'POST /knowledge/notebooks', milliseconds: 300 },
        { operation: 'GET /health', milliseconds: 40 },
        { operation: 'POST /knowledge/notebooks', milliseconds: 100 },
      ]),
    ).toEqual([
      { operation: 'GET /health', count: 1, p50: 40, p95: 40, max: 40 },
      { operation: 'POST /knowledge/notebooks', count: 2, p50: 100, p95: 300, max: 300 },
    ]);
  });
});
