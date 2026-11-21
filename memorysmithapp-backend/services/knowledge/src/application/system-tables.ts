/**
 * The tables of a notebook with its system table beside them (#517).
 *
 * The system table is a view (ADR-031): every call that finds, lists or reads
 * a table sees it, built from the notes Knowledge holds and from what
 * Discovery projected of them, and no call that writes reaches the store with
 * it. Every use case of tables and dashboards reads through this one port, so
 * a query, a dashboard, a `table` block and the connector see the same rows
 * without one of them knowing it is a view.
 *
 * A build is kept for a moment, `keepMs`: a dashboard that asks for the
 * schema, then the table, then its rows within one request reads the notes
 * once, while a worker that holds the repository for a whole import sees the
 * notes it wrote once Discovery projected them.
 */

import {
  DomainError,
  type DomainEvent,
  err,
  type NotebookId,
  type Result,
  type TableId,
} from '@memorysmithapp/kernel';
import type {
  NoteProjections,
  NoteRepository,
  NotebookRepository,
  RowWrite,
  TableRepository,
  TableUsage,
} from '../domain/ports/index.js';
import type { Row } from '../domain/table/Row.js';
import {
  isSystemTable,
  namesSystemNotes,
  SYSTEM_NOTES_ID,
  systemNotesTable,
} from '../domain/table/SystemTable.js';
import type { Table } from '../domain/table/Table.js';

export interface SystemTableSources {
  readonly notebooks: NotebookRepository;
  readonly notes: NoteRepository;
  readonly projections: NoteProjections;
}

export class SystemAwareTableRepository implements TableRepository {
  private readonly built = new Map<
    string,
    { at: number; build: Promise<{ table: Table; rows: Row[] } | null> }
  >();

  constructor(
    private readonly stored: TableRepository,
    private readonly sources: SystemTableSources,
    private readonly keepMs = 2_000,
  ) {}

  private system(notebook: NotebookId): Promise<{ table: Table; rows: Row[] } | null> {
    const now = Date.now();
    const found = this.built.get(notebook.value);
    if (found && now - found.at < this.keepMs) return found.build;
    const build = this.build(notebook);
    this.built.set(notebook.value, { at: now, build });
    return build;
  }

  private async build(notebook: NotebookId): Promise<{ table: Table; rows: Row[] } | null> {
    const held = await this.sources.notebooks.findById(notebook);
    if (!held) return null;
    const [notes, projected] = await Promise.all([
      this.sources.notes.listByNotebook(notebook),
      this.sources.projections.read(notebook),
    ]);
    const folders = held.folders;
    return systemNotesTable({
      subscriptionId: held.subscriptionId,
      notebookId: notebook,
      createdBy: held.createdBy,
      notes: notes
        .filter((note) => !note.isDeleted && folders.has(note.folderId))
        .map((note) => {
          const degree = projected.degrees.get(note.id.value);
          return {
            noteId: note.id.value,
            name: note.name,
            folder: folders.get(note.folderId)?.name.value ?? '',
            createdBy: note.createdBy,
            updatedBy: note.updatedBy,
            backlinks: degree?.backlinks ?? 0,
            links: degree?.links ?? 0,
            facets: projected.facets.get(note.id.value) ?? {},
          };
        }),
    });
  }

  async findById(notebook: NotebookId, table: TableId): Promise<Table | null> {
    if (table.value === SYSTEM_NOTES_ID) return (await this.system(notebook))?.table ?? null;
    return this.stored.findById(notebook, table);
  }

  async findByName(notebook: NotebookId, name: string): Promise<Table | null> {
    if (namesSystemNotes(name)) return (await this.system(notebook))?.table ?? null;
    return this.stored.findByName(notebook, name);
  }

  /** The stored tables, then the system table. */
  async list(notebook: NotebookId): Promise<Table[]> {
    const [stored, system] = await Promise.all([this.stored.list(notebook), this.system(notebook)]);
    return system ? [...stored, system.table] : stored;
  }

  /** Its rows and no bytes: it holds nothing, so it counts in no storage. */
  async usage(table: Table): Promise<TableUsage> {
    if (!isSystemTable(table)) return this.stored.usage(table);
    return { rows: (await this.system(table.notebookId))?.rows.length ?? 0, bytes: 0 };
  }

  async rows(table: Table): Promise<Row[]> {
    if (!isSystemTable(table)) return this.stored.rows(table);
    return (await this.system(table.notebookId))?.rows ?? [];
  }

  async findRows(table: Table, rowIds: readonly string[]): Promise<Row[]> {
    if (!isSystemTable(table)) return this.stored.findRows(table, rowIds);
    const wanted = new Set(rowIds);
    return (await this.rows(table)).filter((row) => wanted.has(row.rowId));
  }

  /*
    The writes refuse it here as well as in the use cases that check first:
    whatever path reaches the store with the system table, nothing is written.
  */
  save(table: Table): Promise<Result<void, DomainError>> {
    return isSystemTable(table) ? refused() : this.stored.save(table);
  }

  writeRows(
    table: Table,
    writes: readonly RowWrite[],
    events: readonly DomainEvent[],
  ): Promise<Result<void, DomainError>> {
    return isSystemTable(table) ? refused() : this.stored.writeRows(table, writes, events);
  }

  lock(table: Table): Promise<Result<Table, DomainError>> {
    return isSystemTable(table) ? refused() : this.stored.lock(table);
  }

  async unlock(table: Table): Promise<void> {
    if (!isSystemTable(table)) await this.stored.unlock(table);
  }

  replaceRows(next: Table, rows: readonly Row[]): Promise<Result<void, DomainError>> {
    return isSystemTable(next) ? refused() : this.stored.replaceRows(next, rows);
  }
}

async function refused(): Promise<Result<never, DomainError>> {
  return err(DomainError.validation('A system table is written by nothing'));
}
