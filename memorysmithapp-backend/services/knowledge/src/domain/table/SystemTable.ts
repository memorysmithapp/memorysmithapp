/**
 * The system table of a notebook, `system-notes` (#517): one row per note,
 * with what the note says of itself in its frontmatter and how many links
 * reach it and leave it, so a dashboard and a `table` block draw from the
 * notes as from any table.
 *
 * It is a view and never a copy: nothing of it is stored. Its rows are built
 * on every read from the notes Knowledge holds and from what Discovery
 * projected of them (the portrait of each note and its links), which is why it
 * follows an edit once the edit is projected, counts in no limit of tables and
 * in no storage, and is written by no path (RN-KNW-093, ADR-031).
 */

import {
  type Authorship,
  DomainError,
  err,
  type NotebookId,
  type Result,
  type SubscriptionId,
  TableId,
} from '@memorysmithapp/kernel';
import type { Row } from './Row.js';
import { Table } from './Table.js';
import {
  type CellValue,
  cellOf,
  type Column,
  type ColumnType,
  TABLE_LIMITS,
} from './TableSchema.js';

/** No table a person or an agent creates or renames may start with it (RN-KNW-094). */
export const SYSTEM_TABLE_PREFIX = 'system-';

/** The name of the system table, the same in every notebook. */
export const SYSTEM_NOTES_NAME = 'system-notes';

/**
 * Its identifier, the same in every notebook: a dashboard keeps a table by
 * identifier (RN-KNW-080), so one drawn from it keeps drawing when the
 * notebook is copied, transferred or made from a model.
 */
export const SYSTEM_NOTES_ID = '000000000000000000000SYSNT';

/** Whether a name is in the namespace the system tables keep for themselves. */
export function isSystemName(name: string): boolean {
  return name.normalize('NFC').trim().toLowerCase().startsWith(SYSTEM_TABLE_PREFIX);
}

export function isSystemTable(table: Table): boolean {
  return table.id.value === SYSTEM_NOTES_ID;
}

/** What every write of a system table answers, naming why. */
export function refuseSystemTable(table: Table): Result<never, DomainError> {
  return err(
    DomainError.validation(
      `"${table.name}" is a system table: its rows are the notes of the notebook, read from them, and nothing writes, alters or deletes it`,
    ),
  );
}

/** The form a value of an attribute was written in, as Discovery read it. */
export type NoteFacetKind = 'date' | 'boolean' | 'text' | 'list';

export interface NoteFacet {
  readonly kind: NoteFacetKind;
  readonly values: readonly string[];
}

/** One note, as the system table needs it. */
export interface NoteFacts {
  readonly noteId: string;
  readonly name: string | null;
  readonly folder: string;
  readonly createdBy: Authorship;
  readonly updatedBy: Authorship;
  readonly backlinks: number;
  readonly links: number;
  readonly facets: Readonly<Record<string, NoteFacet>>;
}

/**
 * The columns every note has, before its attributes. An attribute that carries
 * one of these names is left out: the column already says it, and a filter
 * names a column by its name alone.
 */
const FIXED: ReadonlyArray<{ name: string; type: ColumnType; description: string }> = [
  { name: 'note', type: 'string', description: 'The identifier of the note' },
  { name: 'name', type: 'string', description: 'The name the note states, empty when it has none' },
  { name: 'folder', type: 'string', description: 'The folder the note is in' },
  { name: 'updated', type: 'date-time', description: 'When the note was last written' },
  { name: 'backlinks', type: 'integer', description: 'How many links of other notes reach it' },
  { name: 'links', type: 'integer', description: 'How many links it makes to other notes' },
];

/** A column of a table is named by one word (RN-KNW-067); an attribute that is not one is left out. */
const COLUMN_NAME = /^[\p{L}\p{N}_-]+$/u;
const NUMBER = /^-?\d+(?:\.\d+)?$/;

function column(index: number, name: string, type: ColumnType, description: string): Column {
  return {
    id: `c${index + 1}`,
    name,
    type,
    description,
    required: false,
    default: null,
    enum: null,
    minimum: null,
    maximum: null,
    maxLength: null,
  };
}

/**
 * The type of an attribute's column, from every form its notes wrote it in:
 * one form throughout gives its type, a list anywhere makes it a list, text
 * that is a number in every note is a number, and anything mixed is text.
 */
function typeOf(facets: readonly NoteFacet[]): ColumnType {
  const kinds = new Set(facets.map((facet) => facet.kind));
  if (kinds.has('list')) return 'list';
  if (kinds.size !== 1) return 'string';
  const [kind] = kinds;
  if (kind === 'date') return 'date';
  if (kind === 'boolean') return 'boolean';
  return facets.every((facet) => facet.values.every((value) => NUMBER.test(value)))
    ? 'number'
    : 'string';
}

function cell(target: Column, facet: NoteFacet): CellValue | null {
  if (facet.values.length === 0) return null;
  const raw: unknown =
    target.type === 'list'
      ? [...facet.values]
      : target.type === 'boolean'
        ? facet.values[0] === 'true'
        : target.type === 'string'
          ? facet.values.join(', ')
          : facet.values[0];
  const read = cellOf(target, raw, false);
  return read.ok ? read.value : null;
}

/**
 * The system table of a notebook and its rows, built from its notes. The
 * notes are taken newest first and only as many as a table holds rows
 * (ADR-023); the description says when some were left out.
 */
export function systemNotesTable(input: {
  subscriptionId: SubscriptionId;
  notebookId: NotebookId;
  createdBy: Authorship;
  notes: readonly NoteFacts[];
}): { table: Table; rows: Row[] } {
  const notes = [...input.notes]
    .sort(
      (a, b) =>
        b.updatedBy.at.epochMillis - a.updatedBy.at.epochMillis || a.noteId.localeCompare(b.noteId),
    )
    .slice(0, TABLE_LIMITS.rows);

  const byAttribute = new Map<string, NoteFacet[]>();
  for (const note of notes) {
    for (const [attribute, facet] of Object.entries(note.facets)) {
      const fixed = FIXED.some((each) => each.name === attribute.toLowerCase());
      if (fixed || !COLUMN_NAME.test(attribute)) continue;
      byAttribute.set(attribute, [...(byAttribute.get(attribute) ?? []), facet]);
    }
  }
  const attributes = [...byAttribute.keys()].sort((a, b) => a.localeCompare(b));
  const columns: Column[] = [
    ...FIXED.map((each, index) => column(index, each.name, each.type, each.description)),
    ...attributes.map((attribute, index) =>
      column(
        FIXED.length + index,
        attribute,
        typeOf(byAttribute.get(attribute) ?? []),
        `The ${attribute} the notes declare`,
      ),
    ),
  ];
  const attributeColumns = new Map(
    attributes.map((attribute, index) => [attribute, columns[FIXED.length + index]!]),
  );

  const rows: Row[] = notes.map((note, index) => {
    const values: Record<string, CellValue> = {
      c1: note.noteId,
      c3: note.folder,
      c4: note.updatedBy.at.toISOString(),
      c5: String(note.backlinks),
      c6: String(note.links),
    };
    if (note.name) values['c2'] = note.name;
    for (const [attribute, facet] of Object.entries(note.facets)) {
      const target = attributeColumns.get(attribute);
      if (!target) continue;
      const value = cell(target, facet);
      if (value !== null) values[target.id] = value;
    }
    return {
      rowId: note.noteId,
      values,
      seq: String(index).padStart(6, '0'),
      createdBy: note.createdBy,
      updatedBy: note.updatedBy,
      version: 1,
    };
  });

  const left = input.notes.length - notes.length;
  const description =
    'The notes of this notebook, one row each: what each declares in its frontmatter and how many links reach it and leave it. A system table, read from the notes and written by nothing.' +
    (left > 0
      ? ` It holds the ${notes.length} most recently written; ${left} more are left out.`
      : '');

  const id = TableId.create(SYSTEM_NOTES_ID);
  if (!id.ok) throw new Error('unreachable: the identifier of the system table is a ULID');
  const table = Table.rehydrate({
    id: id.value,
    subscriptionId: input.subscriptionId,
    notebookId: input.notebookId,
    name: SYSTEM_NOTES_NAME,
    description,
    columns,
    key: ['c1'],
    nextColumn: columns.length + 1,
    generation: 1,
    createdBy: input.createdBy,
    updatedBy: notes[0]?.updatedBy ?? input.createdBy,
    deletedAt: null,
    version: 0,
  });
  return { table, rows };
}

/** Whether a reference names the system table, by its identifier or its name. */
export function namesSystemNotes(reference: string): boolean {
  return (
    reference.toUpperCase() === SYSTEM_NOTES_ID ||
    reference.normalize('NFC').trim().toLowerCase() === SYSTEM_NOTES_NAME
  );
}
