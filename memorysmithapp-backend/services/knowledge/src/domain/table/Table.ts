/**
 * A Table of a notebook (#366): a schema, an optional key, and rows kept in a
 * partition of their own.
 *
 * It is an Aggregate Root for the reason a file is: nothing about it is an
 * invariant of the tree, and a row written behind every write of the notebook
 * would queue each one behind the others. The rows are not loaded with it;
 * what the aggregate guards is the schema, and every row write is conditioned
 * on the version of the table it was validated against, so a schema that
 * changed meanwhile refuses the write instead of letting a row that no longer
 * fits in.
 *
 * **A schema change never leaves a row invalid** (RN-KNW-069). An alteration is planned
 * against every row of the table, and either every row fits the new schema or
 * nothing changes and the refusal names the rows that do not. When the rows
 * themselves change (a column removed, a type converted, a key set), the new
 * rows are written as a **generation** of their own, and the table moves to it
 * in one write: a reader sees the old rows or the new ones, never a mix.
 */

import {
  type Authorship,
  createEvent,
  DomainError,
  type DomainEvent,
  err,
  type Instant,
  type NotebookId,
  ok,
  type Result,
  type SubscriptionId,
  type TableId,
} from '@memorysmithapp/kernel';
import { columnNames, hasKey, rowBytes, rowIdOf, type Row } from './Row.js';
import {
  cellOf,
  checkColumnName,
  type CellValue,
  type Column,
  type ColumnDeclaration,
  readColumn,
  sameColumnName,
  TABLE_LIMITS,
} from './TableSchema.js';

/** A table is addressed by its name from a note, so a name is one line. */
const UNADDRESSABLE = /[#[\]|\n\r`]/;

export function checkTableName(raw: string): Result<string, DomainError> {
  const name = raw.normalize('NFC').trim();
  if (name.length === 0) return err(DomainError.validation('A table needs a name'));
  if (name.length > TABLE_LIMITS.nameLength) {
    return err(
      DomainError.validation(`A table name goes up to ${TABLE_LIMITS.nameLength} characters`),
    );
  }
  if (UNADDRESSABLE.test(name)) {
    return err(DomainError.validation('A table name holds no #, [, ], |, backtick or line break'));
  }
  return ok(name);
}

/** One change of `alter_table`, by the names a person and an agent use. */
export type TableChange =
  | { readonly op: 'rename-table'; readonly to: string }
  | { readonly op: 'describe'; readonly description: string }
  | {
      readonly op: 'add-column';
      readonly name: string;
      readonly schema: unknown;
      readonly required?: boolean | undefined;
    }
  | { readonly op: 'rename-column'; readonly column: string; readonly to: string }
  | { readonly op: 'remove-column'; readonly column: string }
  | {
      readonly op: 'change-column';
      readonly column: string;
      readonly schema: unknown;
      readonly required?: boolean | undefined;
    }
  | { readonly op: 'set-key'; readonly columns: readonly string[] | null };

/** What an alteration produces: the table as it becomes and, when the rows change, every row. */
export interface Alteration {
  readonly table: Table;
  readonly rows: Row[] | null;
  readonly changes: string[];
}

export class Table {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: TableId,
    readonly subscriptionId: SubscriptionId,
    readonly notebookId: NotebookId,
    private _name: string,
    private _description: string,
    private _columns: readonly Column[],
    private _key: readonly string[] | null,
    private _nextColumn: number,
    private _generation: number,
    readonly createdBy: Authorship,
    private _updatedBy: Authorship,
    private _deletedAt: Instant | null,
    private _version: number,
    private readonly _lockedUntil: Instant | null = null,
  ) {}

  static create(input: {
    id: TableId;
    subscriptionId: SubscriptionId;
    notebookId: NotebookId;
    name: string;
    description: string;
    columns: readonly ColumnDeclaration[];
    key: readonly string[] | null;
    by: Authorship;
  }): Result<Table, DomainError> {
    const name = checkTableName(input.name);
    if (!name.ok) return name;
    const description = describe(input.description);
    if (!description.ok) return description;
    if (input.columns.length === 0) {
      return err(DomainError.validation('A table declares at least one column'));
    }
    if (input.columns.length > TABLE_LIMITS.columns) {
      return err(DomainError.validation(`A table holds up to ${TABLE_LIMITS.columns} columns`));
    }
    const columns = input.columns.map((column, index) => ({ ...column, id: `c${index + 1}` }));
    const key = keyOf(columns, input.key);
    if (!key.ok) return key;

    const table = new Table(
      input.id,
      input.subscriptionId,
      input.notebookId,
      name.value,
      description.value,
      columns,
      key.value,
      columns.length + 1,
      1,
      input.by,
      input.by,
      null,
      0,
    );
    table.record('TableCreated', input.by, { columns: columns.map((column) => column.name) });
    return ok(table);
  }

  /** What the repository rebuilds from the item, with no rule re-run. */
  static rehydrate(input: {
    id: TableId;
    subscriptionId: SubscriptionId;
    notebookId: NotebookId;
    name: string;
    description: string;
    columns: readonly Column[];
    key: readonly string[] | null;
    nextColumn: number;
    generation: number;
    createdBy: Authorship;
    updatedBy: Authorship;
    deletedAt: Instant | null;
    version: number;
    lockedUntil?: Instant | null;
  }): Table {
    return new Table(
      input.id,
      input.subscriptionId,
      input.notebookId,
      input.name,
      input.description,
      input.columns,
      input.key,
      input.nextColumn,
      input.generation,
      input.createdBy,
      input.updatedBy,
      input.deletedAt,
      input.version,
      input.lockedUntil ?? null,
    );
  }

  get name(): string {
    return this._name;
  }
  get description(): string {
    return this._description;
  }
  get columns(): readonly Column[] {
    return this._columns;
  }
  /** The column identifiers of the key, or `null` when rows have none. */
  get key(): readonly string[] | null {
    return this._key;
  }
  get keyNames(): string[] | null {
    return this._key ? columnNames(this._columns, this._key) : null;
  }
  get nextColumn(): number {
    return this._nextColumn;
  }
  /** Which generation of rows is the table's; the others are leftovers. */
  get generation(): number {
    return this._generation;
  }
  get updatedBy(): Authorship {
    return this._updatedBy;
  }
  get deletedAt(): Instant | null {
    return this._deletedAt;
  }
  get version(): number {
    return this._version;
  }
  get isDeleted(): boolean {
    return this._deletedAt !== null;
  }
  get lockedUntil(): Instant | null {
    return this._lockedUntil;
  }
  /** Whether an alteration is rewriting the rows right now. */
  isLocked(now: Instant): boolean {
    return this._lockedUntil !== null && this._lockedUntil.isAfter(now);
  }

  column(name: string): Column | undefined {
    return this._columns.find((column) => sameColumnName(column.name, name));
  }

  /**
   * Plans every change of one `alter_table` against every row, in order, and
   * either all of them hold or none does (RN-KNW-069). The rows are
   * given only when the table holds any; an alteration that touches no value
   * returns `rows: null`, and the rows stay where they are.
   */
  alter(
    changes: readonly TableChange[],
    rows: readonly Row[],
    by: Authorship,
  ): Result<Alteration, DomainError> {
    if (changes.length === 0)
      return err(DomainError.validation('An alteration needs at least one change'));
    let name = this._name;
    let description = this._description;
    let columns = [...this._columns];
    let key = this._key;
    let next = this._nextColumn;
    let values: Array<Record<string, CellValue>> | null = null;
    const said: string[] = [];
    const current = (): Array<Record<string, CellValue>> => {
      values ??= rows.map((row) => ({ ...row.values }));
      return values;
    };
    const find = (raw: string): Result<Column, DomainError> => {
      const found = columns.find((column) => sameColumnName(column.name, raw));
      return found ? ok(found) : err(DomainError.validation(`The table has no column "${raw}"`));
    };

    for (const change of changes) {
      switch (change.op) {
        case 'rename-table': {
          const renamed = checkTableName(change.to);
          if (!renamed.ok) return renamed;
          said.push(`renamed the table from ${name} to ${renamed.value}`);
          name = renamed.value;
          break;
        }
        case 'describe': {
          const described = describe(change.description);
          if (!described.ok) return described;
          description = described.value;
          said.push('described the table');
          break;
        }
        case 'add-column': {
          if (columns.length >= TABLE_LIMITS.columns) {
            return err(
              DomainError.validation(`A table holds up to ${TABLE_LIMITS.columns} columns`),
            );
          }
          const declared = readColumn(change.name, change.schema, change.required ?? false);
          if (!declared.ok) return declared;
          if (columns.some((column) => sameColumnName(column.name, declared.value.name))) {
            return err(
              DomainError.conflict(`The table already has a column "${declared.value.name}"`),
            );
          }
          const column: Column = { ...declared.value, id: `c${next}` };
          next += 1;
          if (rows.length > 0) {
            if (column.required && column.default === null) {
              return err(
                DomainError.validation(
                  `"${column.name}" is required with no default, and the ${rows.length} rows of the table would hold no value for it`,
                ),
              );
            }
            if (column.default !== null) {
              for (const row of current()) row[column.id] = column.default;
            }
          }
          columns.push(column);
          said.push(`added the column ${column.name}`);
          break;
        }
        case 'rename-column': {
          const column = find(change.column);
          if (!column.ok) return column;
          const to = checkColumnName(change.to);
          if (!to.ok) return to;
          const taken = columns.find(
            (each) => each.id !== column.value.id && sameColumnName(each.name, to.value),
          );
          if (taken)
            return err(DomainError.conflict(`The table already has a column "${taken.name}"`));
          columns = columns.map((each) =>
            each.id === column.value.id ? { ...each, name: to.value } : each,
          );
          said.push(`renamed the column ${column.value.name} to ${to.value}`);
          break;
        }
        case 'remove-column': {
          const column = find(change.column);
          if (!column.ok) return column;
          if (columns.length === 1)
            return err(DomainError.validation('A table keeps at least one column'));
          if (key?.includes(column.value.id)) {
            return err(
              DomainError.validation(
                `"${column.value.name}" is part of the key: set another key, or none, first`,
              ),
            );
          }
          columns = columns.filter((each) => each.id !== column.value.id);
          if (rows.length > 0) for (const row of current()) delete row[column.value.id];
          said.push(`removed the column ${column.value.name}`);
          break;
        }
        case 'change-column': {
          const column = find(change.column);
          if (!column.ok) return column;
          const declared = readColumn(
            column.value.name,
            change.schema,
            change.required ?? column.value.required,
          );
          if (!declared.ok) return declared;
          const changed: Column = { ...declared.value, id: column.value.id };
          if (rows.length > 0) {
            const refused: string[] = [];
            const converted = current().map((row, index) => {
              const value = row[changed.id];
              if (value === undefined) {
                if (changed.required && changed.default === null)
                  refused.push(rows[index]?.rowId ?? '');
                else if (changed.required && changed.default !== null)
                  row[changed.id] = changed.default;
                return row;
              }
              const fits = cellOf(changed, value, false);
              if (!fits.ok) refused.push(rows[index]?.rowId ?? '');
              else row[changed.id] = fits.value;
              return row;
            });
            if (refused.length > 0) return refusedRows(changed.name, refused);
            values = converted;
          }
          if (key?.includes(changed.id) && changed.type === 'list') {
            return err(
              DomainError.validation(
                `"${changed.name}" is part of the key, and a key holds no list`,
              ),
            );
          }
          columns = columns.map((each) => (each.id === changed.id ? changed : each));
          said.push(`changed the column ${changed.name}`);
          break;
        }
        case 'set-key': {
          const chosen = keyOf(columns, change.columns);
          if (!chosen.ok) return chosen;
          key = chosen.value;
          said.push(
            key ? `set the key to ${columnNames(columns, key).join(', ')}` : 'removed the key',
          );
          // Rows are addressed by their key, so a new key gives every row a
          // new identifier and two rows that the key now confuses refuse it.
          if (rows.length > 0 && (key !== null || this._key !== null)) current();
          break;
        }
      }
    }

    // The key is checked once every change is planned, on the rows as they
    // will be, so a key set before a column it names is converted still holds.
    let rewritten: Row[] | null = null;
    if (values !== null) {
      const keyChanged = JSON.stringify(key) !== JSON.stringify(this._key);
      const seen = new Map<string, string>();
      const missing: string[] = [];
      const clashing: string[] = [];
      rewritten = rows.map((row, index) => {
        const held = (values as Array<Record<string, CellValue>>)[index] ?? {};
        let rowId = row.rowId;
        if (keyChanged) {
          if (key && !hasKey(key, held)) missing.push(row.rowId);
          rowId = key
            ? rowIdOf(key, held)
            : row.rowId.startsWith('K')
              ? rowIdOf(null, held)
              : row.rowId;
          const earlier = seen.get(rowId);
          if (key && earlier) clashing.push(`${earlier} and ${row.rowId}`);
          seen.set(rowId, row.rowId);
        }
        if (rowBytes(held) > TABLE_LIMITS.rowBytes) missing.push(row.rowId);
        return { ...row, rowId, values: held, updatedBy: by };
      });
      if (missing.length > 0) {
        return err(
          DomainError.validation(
            `These rows would have no value for the key, or would grow past ${TABLE_LIMITS.rowBytes} bytes: ${missing.slice(0, 20).join(', ')}`,
          ),
        );
      }
      if (clashing.length > 0) {
        return err(
          DomainError.conflict(
            `The key would name two rows at once: ${clashing.slice(0, 20).join('; ')}`,
          ),
        );
      }
    }

    const before = rows.reduce((sum, row) => sum + rowBytes(row.values), 0);
    const after = rewritten
      ? rewritten.reduce((sum, row) => sum + rowBytes(row.values), 0)
      : before;
    const table = new Table(
      this.id,
      this.subscriptionId,
      this.notebookId,
      name,
      description,
      columns,
      key,
      next,
      rewritten ? this._generation + 1 : this._generation,
      this.createdBy,
      by,
      null,
      this._version,
    );
    table.record('TableAltered', by, { changes: said }, after - before);
    return ok({ table, rows: rewritten, changes: said });
  }

  /**
   * Deleting is definitive and the rows go with it (INV-08): the purge
   * destroys them, and every note that shows the table says it is missing
   * from this instant. The bytes leave the count at the deletion.
   */
  delete(rows: number, bytes: number, by: Authorship, at: Instant): Result<void, DomainError> {
    if (this.isDeleted) return err(DomainError.notFound('Table not found'));
    this._deletedAt = at;
    this._updatedBy = by;
    this.record('TableDeleted', by, { rows }, -bytes);
    return ok(undefined);
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  nextVersion(): number {
    return this._version + 1;
  }

  /** An event about rows, carried by the write of the rows. */
  rowsEvent(
    type: 'RowsInserted' | 'RowsUpdated' | 'RowsDeleted',
    by: Authorship,
    operationId: string,
    rows: ReadonlyArray<{ rowId: string; columns: Iterable<string> }>,
    bytesDelta: number,
  ): DomainEvent {
    return createEvent({
      type,
      subscriptionId: this.subscriptionId,
      subject: 'TABLE',
      subjectId: this.id.value,
      authorship: by,
      payload: {
        notebookId: this.notebookId.value,
        tableId: this.id.value,
        table: this._name,
        operationId,
        rows: rows.map((row) => ({
          rowId: row.rowId,
          columns: columnNames(this._columns, row.columns),
        })),
      },
      storageDelta: bytesDelta,
    });
  }

  private record(
    type: 'TableCreated' | 'TableAltered' | 'TableDeleted',
    by: Authorship,
    extra: Record<string, unknown>,
    bytesDelta = 0,
  ): void {
    this.events.push(
      createEvent({
        type,
        subscriptionId: this.subscriptionId,
        subject: 'TABLE',
        subjectId: this.id.value,
        authorship: by,
        payload: {
          notebookId: this.notebookId.value,
          tableId: this.id.value,
          name: this._name,
          ...extra,
        },
        storageDelta: bytesDelta,
      }),
    );
  }
}

function describe(raw: string): Result<string, DomainError> {
  const description = raw.trim();
  if (description.length > TABLE_LIMITS.descriptionLength) {
    return err(
      DomainError.validation(
        `A description goes up to ${TABLE_LIMITS.descriptionLength} characters`,
      ),
    );
  }
  return ok(description);
}

function keyOf(
  columns: readonly Column[],
  names: readonly string[] | null,
): Result<string[] | null, DomainError> {
  if (!names || names.length === 0) return ok(null);
  const ids: string[] = [];
  for (const name of names) {
    const column = columns.find((each) => sameColumnName(each.name, name));
    if (!column)
      return err(DomainError.validation(`The key names "${name}", which is not a column`));
    if (column.type === 'list')
      return err(DomainError.validation(`"${column.name}" holds a list, and a key holds none`));
    if (ids.includes(column.id))
      return err(DomainError.validation(`The key names "${column.name}" twice`));
    ids.push(column.id);
  }
  return ok(ids);
}

function refusedRows(column: string, rowIds: readonly string[]): Result<never, DomainError> {
  return err(
    DomainError.validation(
      `${rowIds.length} rows do not fit the new "${column}": ${rowIds.slice(0, 20).join(', ')}${rowIds.length > 20 ? ', …' : ''}`,
    ),
  );
}
