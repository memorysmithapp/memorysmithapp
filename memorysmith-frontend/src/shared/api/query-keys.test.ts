/**
 * The query keys of the interface (#170).
 *
 * These exist because of a defect that could not fail: a write invalidated
 * `['structure', notebookId]`, a key no query holds, and `invalidateQueries`
 * on an unregistered key is a silent no-op. A rename landed on the note and
 * left the folder tree — and with it the link index the whole reading surface
 * asks — showing the old name until a reload.
 *
 * The type is the real guard: a key is a function call now, so a typo is a
 * compile error. What is left for a test is the half a type cannot state —
 * that no two keys collide, and that invalidating the key a query holds is
 * what actually refetches it.
 */

import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';
const NOTE = '01J8X2K9QZ3M4N5P6R7S8T9VN1';

describe('the query keys of the interface', () => {
  it('names each cache once, with no two sharing a prefix', () => {
    const heads = Object.values(queryKeys).map((make) => {
      // Every factory takes strings or nothing; the head is what matters here.
      const key = (make as (...args: string[]) => readonly unknown[])(NOTEBOOK, NOTE);
      return key[0];
    });

    expect(new Set(heads).size, 'two caches answer to the same name').toBe(heads.length);
  });

  it('invalidates the query that holds the key, which is what the defect did not', async () => {
    /**
     * `staleTime: Infinity` is what makes this a test of INVALIDATION. With
     * the default of zero the data is stale the instant it lands, so every
     * `fetchQuery` refetches whatever anybody invalidated, and the case would
     * pass against the defect it exists to catch.
     */
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    let reads = 0;
    const read = async () => {
      reads += 1;
      return reads;
    };

    // The tree of a notebook, as `NotebookLayout` holds it.
    await client.fetchQuery({ queryKey: queryKeys.notebookStructure(NOTEBOOK), queryFn: read });
    expect(reads).toBe(1);

    /**
     * What the rename used to do: a key nobody holds. It resolves, nothing
     * throws, and the tree is never read again — which is the whole defect,
     * and the reason it survived a release.
     */
    await client.invalidateQueries({ queryKey: ['structure', NOTEBOOK] });
    await client.fetchQuery({ queryKey: queryKeys.notebookStructure(NOTEBOOK), queryFn: read });
    expect(reads, 'a key nobody holds invalidated something').toBe(1);

    // And what it does now.
    await client.invalidateQueries({ queryKey: queryKeys.notebookStructure(NOTEBOOK) });
    await client.fetchQuery({ queryKey: queryKeys.notebookStructure(NOTEBOOK), queryFn: read });
    expect(reads, 'the tree was not read again after being invalidated').toBe(2);
  });

  it('tells two notebooks apart, and two notes of one notebook apart', () => {
    const other = '01J8X2K9QZ3M4N5P6R7S8T9V0B';

    expect(queryKeys.notebookStructure(NOTEBOOK)).not.toEqual(queryKeys.notebookStructure(other));
    expect(queryKeys.note(NOTEBOOK, NOTE)).not.toEqual(queryKeys.note(other, NOTE));
    expect(queryKeys.note(NOTEBOOK, NOTE)).not.toEqual(
      queryKeys.note(NOTEBOOK, '01J8X2K9QZ3M4N5P6R7S8T9VN2'),
    );
  });
});
