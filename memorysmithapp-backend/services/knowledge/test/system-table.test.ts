/**
 * The system table of a notebook (#517): its columns, typed by the form the
 * notes wrote each attribute in, its rows, and the namespace it keeps.
 */

import { describe, expect, it } from 'vitest';
import { Instant, NotebookId, SubscriptionId, ulid } from '@memorysmithapp/kernel';
import { namesSystemNotesTable, SYSTEM_NOTES_TABLE } from '@memorysmithapp/contracts';
import { checkTableName } from '../src/domain/table/Table.js';
import {
  isSystemName,
  namesSystemNotes,
  type NoteFacts,
  SYSTEM_NOTES_NAME,
  SYSTEM_NOTES_ID,
  systemNotesTable,
} from '../src/domain/table/SystemTable.js';
import { TABLE_LIMITS } from '../src/domain/table/TableSchema.js';
import { authorship, unwrap } from './fixtures.js';

const subscriptionId = unwrap(SubscriptionId.fromClaim(ulid()));
const notebookId = unwrap(NotebookId.create(ulid()));

function note(overrides: Partial<NoteFacts> = {}): NoteFacts {
  const by = authorship();
  return {
    noteId: ulid(),
    name: 'Nota',
    folder: 'Tarefas',
    createdBy: by,
    updatedBy: by,
    backlinks: 0,
    links: 0,
    facets: {},
    ...overrides,
  };
}

const build = (notes: NoteFacts[]) =>
  systemNotesTable({ subscriptionId, notebookId, createdBy: authorship(), notes });

describe('the system table of a notebook (#517)', () => {
  it('has the same identifier and name in every notebook, and keys its rows by note', () => {
    const { table } = build([]);
    expect(table.id.value).toBe(SYSTEM_NOTES_ID);
    expect(table.name).toBe('system-notes');
    expect(table.keyNames).toEqual(['note']);
    expect(namesSystemNotes('System-Notes')).toBe(true);
    expect(namesSystemNotes(SYSTEM_NOTES_ID.toLowerCase())).toBe(true);
  });

  it('types a column by every form its notes wrote it in', () => {
    const { table } = build([
      note({
        facets: {
          due: { kind: 'date', values: ['2026-12-01'] },
          hours: { kind: 'text', values: ['3'] },
          code: { kind: 'text', values: ['A1'] },
          mixed: { kind: 'date', values: ['2026-12-01'] },
          tags: { kind: 'text', values: ['casa'] },
        },
      }),
      note({
        facets: {
          due: { kind: 'date', values: ['2026-11-01'] },
          hours: { kind: 'text', values: ['1.5'] },
          code: { kind: 'text', values: ['7'] },
          mixed: { kind: 'boolean', values: ['true'] },
          tags: { kind: 'list', values: ['obra', 'casa'] },
        },
      }),
    ]);
    const typeOf = (name: string) => table.column(name)?.type;
    expect(typeOf('due')).toBe('date');
    expect(typeOf('hours')).toBe('number');
    expect(typeOf('code')).toBe('string');
    expect(typeOf('mixed')).toBe('string');
    expect(typeOf('tags')).toBe('list');
  });

  it('leaves out an attribute that names a column it already has, or is not one word', () => {
    const { table } = build([
      note({
        facets: {
          folder: { kind: 'text', values: ['x'] },
          'two words': { kind: 'text', values: ['x'] },
          ok: { kind: 'text', values: ['x'] },
        },
      }),
    ]);
    expect(table.columns.map((column) => column.name)).toEqual([
      'note',
      'name',
      'folder',
      'updated',
      'backlinks',
      'links',
      'ok',
    ]);
  });

  it('holds as many notes as a table holds rows, the newest, and says how many it left out', () => {
    const many = Array.from({ length: TABLE_LIMITS.rows + 2 }, (_, index) =>
      note({ updatedBy: authorship(unwrap(Instant.fromEpochMillis(1_000_000 + index))) }),
    );
    const { table, rows } = build(many);
    expect(rows).toHaveLength(TABLE_LIMITS.rows);
    expect(rows[0]?.rowId).toBe(many.at(-1)?.noteId);
    expect(table.description).toMatch(/2 more are left out/);
  });

  it('keeps the prefix system- from every table a person or an agent names', () => {
    expect(isSystemName(' System-x ')).toBe(true);
    expect(checkTableName('system-notes').ok).toBe(false);
    expect(checkTableName('SYSTEM-mine').ok).toBe(false);
    expect(checkTableName('my-system-notes').ok).toBe(true);
  });
});

describe('the name the interface knows it by (#524)', () => {
  it('is the name Knowledge gives it, compared the same way', () => {
    expect(SYSTEM_NOTES_TABLE).toBe(SYSTEM_NOTES_NAME);
    for (const name of ['system-notes', ' System-Notes ', 'SYSTEM-NOTES']) {
      expect(namesSystemNotesTable(name)).toBe(namesSystemNotes(name));
      expect(namesSystemNotesTable(name)).toBe(true);
    }
    expect(namesSystemNotesTable('system-note')).toBe(false);
  });
});
