/**
 * How a folder orders its notes (#262, RN-KNW-056).
 *
 * A folder read in sequence — the chapters of a guide, the steps of a process —
 * keeps the order written into it, `manual`, which is the default. A folder of
 * records — minutes, decisions, articles — is looked through by name, and
 * declares `alphabetical`. The order is data of the folder, beside its
 * description and its Template, so the person, the agent and the export read
 * the same thing.
 *
 * The comparison lives here because three places order the notes of a folder —
 * the knowledge service that lists them, the connector that pages them and the
 * screen that draws them — and they may not disagree about where a note is.
 */

export const NOTE_ORDERS = ['manual', 'alphabetical'] as const;
export type NoteOrder = (typeof NOTE_ORDERS)[number];

export const DEFAULT_NOTE_ORDER: NoteOrder = 'manual';

/** Whatever is not one of the two orders is the default, as an item written before them. */
export function noteOrderOf(value: unknown): NoteOrder {
  return (NOTE_ORDERS as readonly unknown[]).includes(value)
    ? (value as NoteOrder)
    : DEFAULT_NOTE_ORDER;
}

/**
 * One fixed collation for every notebook, so a note sits in the same place
 * whoever reads it and in whatever language: the root collation, comparing
 * numbers by value — *Ata 2* before *Ata 10* — and letters by their base, so
 * neither case nor an accent decides the order on its own.
 */
const NAMES = new Intl.Collator('und', { numeric: true, sensitivity: 'base' });

/** A note as the order reads it: its name, or null when it states none, and its identifier. */
export interface NamedNote {
  readonly name: string | null;
  readonly noteId: string;
}

/**
 * The order of two notes of an alphabetical folder: by name; a note that
 * states no name after every named one; and then, so the order is total and
 * the same everywhere, the exact name and the identifier.
 */
export function compareByName(left: NamedNote, right: NamedNote): number {
  if (left.name === null || right.name === null) {
    if (left.name !== right.name) return left.name === null ? 1 : -1;
  } else {
    const byName = NAMES.compare(left.name, right.name);
    if (byName !== 0) return byName;
    if (left.name !== right.name) return left.name < right.name ? -1 : 1;
  }
  return left.noteId < right.noteId ? -1 : left.noteId > right.noteId ? 1 : 0;
}
