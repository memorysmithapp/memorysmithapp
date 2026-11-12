import type { NoteSummary } from '../../shared/types/api';

/** What the table is sorted by; `order` is the folder's own order (RN-KNW-056). */
export type SortKey = 'order' | 'name' | 'property' | 'updated' | 'author';
export interface Sort {
  key: SortKey;
  direction: 'asc' | 'desc';
}

/**
 * The next sort when a column is pressed: up, then down, then back to the
 * folder's own order, so the order a person or an agent gave the folder is
 * always one press away.
 */
export function nextSort(current: Sort, key: Exclude<SortKey, 'order'>): Sort {
  if (current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return { key: 'order', direction: 'asc' };
}

/** The notes in the order asked for; the folder's order breaks every tie. */
export function sortNotes(
  notes: readonly NoteSummary[],
  sort: Sort,
  values: (note: NoteSummary) => string[],
  author: (note: NoteSummary) => string,
  locale: string,
): NoteSummary[] {
  const position = new Map(notes.map((note, index) => [note.id, index]));
  if (sort.key === 'order') return [...notes];
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const text = (note: NoteSummary): string => {
    switch (sort.key) {
      case 'name':
        return note.name ?? '';
      case 'property':
        return values(note).join(', ');
      case 'author':
        return author(note);
      default:
        return note.updatedAt;
    }
  };
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...notes].sort((a, b) => {
    const left = text(a);
    const right = text(b);
    // A note with no value goes last, whichever way the column is read.
    if (!left !== !right) return left ? -1 : 1;
    const compared =
      sort.key === 'updated' ? left.localeCompare(right) : collator.compare(left, right);
    return compared * sign || (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0);
  });
}
