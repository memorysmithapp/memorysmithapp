import type { SubscriptionUsageDto } from '@memorysmith/contracts';

/**
 * What the space panel of the Home screen draws, shaped out of the answer of
 * `GET /access/usage` (#197, #198). Kept apart from the component because it
 * is where the decisions are: the order of the kinds, and how the tail of the
 * notebooks is grouped.
 */

export type KindKey = 'files' | 'notes' | 'exports' | 'others';

export interface KindLine {
  readonly key: KindKey;
  readonly count: number;
  readonly bytes: number;
}

/** The kinds largest first, which is the order the table and the bar read. */
export function kindsBySpace(usage: SubscriptionUsageDto): KindLine[] {
  const keys: KindKey[] = ['files', 'notes', 'exports', 'others'];
  return keys
    .map((key) => ({ key, count: usage.byType[key].count, bytes: usage.byType[key].bytes }))
    .sort((a, b) => b.bytes - a.bytes);
}

export interface NotebookLine {
  readonly notebookId: string | null;
  readonly name: string | null;
  /** How many notebooks the line stands for: 1, or the size of the tail. */
  readonly grouped: number;
  readonly bytes: number;
  readonly notes: number;
  readonly folders: number;
  readonly files: number;
  readonly exports: number;
}

/**
 * The notebooks largest first, the first `shown` by name and the rest as one
 * line, "Mais N cadernos", with their numbers added up. The list arrives
 * ordered by the API, and is ordered again here, because a screen that trusts
 * an order it did not ask for draws the wrong line on top the day it changes.
 */
export function notebookLines(usage: SubscriptionUsageDto, shown = 3): NotebookLine[] {
  const sorted = [...usage.notebooks].sort((a, b) => b.bytes - a.bytes);
  const head: NotebookLine[] = sorted
    .slice(0, shown)
    .map((each) => ({ ...each, notebookId: each.notebookId, name: each.name, grouped: 1 }));
  const tail = sorted.slice(shown);
  if (tail.length === 0) return head;
  const sum = (pick: (each: (typeof tail)[number]) => number) =>
    tail.reduce((total, each) => total + pick(each), 0);
  return [
    ...head,
    {
      notebookId: null,
      name: null,
      grouped: tail.length,
      bytes: sum((each) => each.bytes),
      notes: sum((each) => each.notes),
      folders: sum((each) => each.folders),
      files: sum((each) => each.files),
      exports: sum((each) => each.exports),
    },
  ];
}

/** The share of the bar a segment takes, never below what can be seen. */
export function shareOf(bytes: number, total: number): number {
  return total > 0 ? (bytes / total) * 100 : 0;
}
