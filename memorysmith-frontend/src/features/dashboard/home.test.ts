/**
 * The decisions of the Home screen (#198) that a screen would only show one
 * of: the order of the notebooks, the drawing each one gets, and how the
 * space of the subscription is split and grouped.
 */

import { describe, expect, it } from 'vitest';
import type { SubscriptionUsageDto } from '@memorysmith/contracts';
import type { NotebookSummary } from '../../shared/types/api';
import { byName } from './catalogue';
import { graphIndexOf } from './card-graphs';
import { kindsBySpace, notebookLines } from './space';

const notebook = (id: string, name: string): NotebookSummary => ({
  id,
  slug: name.toLowerCase(),
  name,
  description: '',
  noteCount: 0,
  updatedAt: '2026-09-22T00:00:00.000Z',
  effectiveRole: 'OWNER',
});

describe('the notebooks are listed by name, in the language of the reader', () => {
  it('puts an accented name where the language puts it, not after the end of the alphabet', () => {
    const names = byName(
      [
        notebook('1', 'Execução'),
        notebook('2', 'Zebra'),
        notebook('3', 'Ética'),
        notebook('4', 'Estratégia'),
      ],
      'pt-BR',
    ).map((each) => each.name);
    expect(names).toEqual(['Estratégia', 'Ética', 'Execução', 'Zebra']);
  });

  it('reads a number as a number: 2 before 10', () => {
    const names = byName([notebook('1', 'Caderno 10'), notebook('2', 'Caderno 2')], 'pt-BR');
    expect(names.map((each) => each.name)).toEqual(['Caderno 2', 'Caderno 10']);
  });
});

describe('each notebook keeps the same drawing', () => {
  it('chooses by the whole identifier, so ids created in the same second spread out', () => {
    // Twelve ULIDs sharing their timestamp, which is their first ten characters.
    const ids = Array.from(
      { length: 12 },
      (_, at) => `01J8X2K9QZ${'ABCDEFGHJKMN'[at]}4N5P6R7S8T9V0A`,
    );
    const drawings = new Set(ids.map(graphIndexOf));
    expect(drawings.size).toBeGreaterThan(3);
    for (const id of ids) expect(graphIndexOf(id)).toBe(graphIndexOf(id));
    for (const id of ids) expect(graphIndexOf(id)).toBeLessThan(8);
  });
});

const usage = (notebooks: SubscriptionUsageDto['notebooks']): SubscriptionUsageDto => ({
  usedBytes: 641,
  quotaBytes: 1024,
  byType: {
    notes: { count: 192, bytes: 148 },
    files: { count: 86, bytes: 402 },
    exports: { count: 3, bytes: 52 },
    others: { count: 15, bytes: 10 },
  },
  counts: { notebooks: notebooks.length, folders: 31, revisions: 1284 },
  notebooks,
});

const line = (notebookId: string, bytes: number) => ({
  notebookId,
  name: notebookId,
  bytes,
  notes: 1,
  folders: 2,
  files: 0,
  exports: 1,
});

describe('the space of the subscription', () => {
  it('orders the kinds by the space they take, largest first', () => {
    expect(kindsBySpace(usage([])).map((kind) => kind.key)).toEqual([
      'files',
      'notes',
      'exports',
      'others',
    ]);
  });

  it('names the three largest notebooks and adds the rest up in one line', () => {
    const lines = notebookLines(
      usage([line('C', 10), line('A', 300), line('D', 5), line('B', 100), line('E', 1)]),
    );
    expect(lines.map((each) => each.name)).toEqual(['A', 'B', 'C', null]);
    expect(lines[3]).toMatchObject({ grouped: 2, bytes: 6, notes: 2, folders: 4, exports: 2 });
  });

  it('draws three notebooks or fewer without a group', () => {
    const lines = notebookLines(usage([line('A', 3), line('B', 2)]));
    expect(lines.every((each) => each.grouped === 1)).toBe(true);
  });
});
