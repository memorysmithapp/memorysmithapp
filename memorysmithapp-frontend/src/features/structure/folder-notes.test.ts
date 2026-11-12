/**
 * The notes of a folder as a table (#416): a column sorts up, then down, then
 * gives the folder its own order back, and a note with no value for the
 * column waits at the end whichever way it is read.
 */

import { describe, expect, it } from 'vitest';
import type { NoteSummary } from '../../shared/types/api';
import { nextSort, sortNotes, type Sort } from './folder-notes';

function note(
  id: string,
  name: string,
  updatedAt: string,
  agent: string | null = null,
): NoteSummary {
  return { id, name, folderId: 'F', updatedAt, updatedBy: { userId: 'u', agent } };
}

const NOTES = [
  note('a', 'Zeta', '2026-11-01T00:00:00.000Z'),
  note('b', 'alfa', '2026-11-09T00:00:00.000Z', 'Claude'),
  note('c', 'Ética', '2026-11-05T00:00:00.000Z'),
  note('d', 'Beta', '2026-11-05T00:00:00.000Z'),
];
const STATUS: Record<string, string[]> = { a: ['open'], b: [], c: ['done'], d: ['open'] };

const ids = (sort: Sort) =>
  sortNotes(
    NOTES,
    sort,
    (each) => STATUS[each.id] ?? [],
    (each) => each.updatedBy.agent ?? 'you',
    'pt-BR',
  ).map((each) => each.id);

describe('the notes of a folder as a table', () => {
  it('keeps the folder order until a column is pressed', () => {
    expect(ids({ key: 'order', direction: 'asc' })).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sorts by name the way the reader’s language does', () => {
    expect(ids({ key: 'name', direction: 'asc' })).toEqual(['b', 'd', 'c', 'a']);
    expect(ids({ key: 'name', direction: 'desc' })).toEqual(['a', 'c', 'd', 'b']);
  });

  it('sorts by when a note changed, the folder order breaking a tie', () => {
    expect(ids({ key: 'updated', direction: 'desc' })).toEqual(['b', 'c', 'd', 'a']);
  });

  it('puts a note with no value last, both ways', () => {
    expect(ids({ key: 'property', direction: 'asc' })).toEqual(['c', 'a', 'd', 'b']);
    expect(ids({ key: 'property', direction: 'desc' }).at(-1)).toBe('b');
  });

  it('goes up, then down, then back to the order of the folder', () => {
    let sort: Sort = { key: 'order', direction: 'asc' };
    sort = nextSort(sort, 'updated');
    expect(sort).toEqual({ key: 'updated', direction: 'asc' });
    sort = nextSort(sort, 'updated');
    expect(sort).toEqual({ key: 'updated', direction: 'desc' });
    expect(nextSort(sort, 'updated')).toEqual({ key: 'order', direction: 'asc' });
    expect(nextSort(sort, 'name')).toEqual({ key: 'name', direction: 'asc' });
  });
});
