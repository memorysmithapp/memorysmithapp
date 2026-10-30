/**
 * The Tables of a notebook (#366): a schema declared as data, and rows an
 * agent writes through the connector and a note presents.
 *
 * Who may do what follows the share profiles (RN-KNW-074, RN-ACC-032): reading
 * a table is reading the notebook; writing its rows is writing content, as a
 * note is; creating, altering and deleting a table is maintaining the
 * notebook, as a folder is.
 *
 * Every row a call writes is checked against the schema before anything is
 * written, and a call is all or nothing: one row that does not fit refuses the
 * call naming it, and no row of it is kept.
 */

import {
  type Authorship,
  DomainError,
  err,
  Instant,
  type NotebookId,
  ok,
  type Result,
  TableId,
  ulid,
} from '@memorysmithapp/kernel';
import type { RequestContext } from '../domain/access/AuthorizationPolicy.js';
import type { RowWrite, TableRepository, TableUsage } from '../domain/ports/index.js';
import { admitWrite } from '../domain/services/StorageQuota.js';
import { hasKey, rowBytes, rowIdOf, type Row } from '../domain/table/Row.js';
import {
  checkOrder,
  compileFilter,
  DEFAULT_PAGE_SIZE,
  pageOf,
  type RowOrder,
  type RowPage,
} from '../domain/table/RowQuery.js';
import { Table, type TableChange } from '../domain/table/Table.js';
import { aggregate, type AggregateGroup, readAggregate } from '../domain/table/RowAggregate.js';
import {
  cellOf,
  type CellValue,
  readSchema,
  sameColumnName,
  TABLE_LIMITS,
} from '../domain/table/TableSchema.js';
import { loadAuthorized, type NotebookDependencies } from './notebooks.js';

export interface TableDependencies extends NotebookDependencies {
  readonly tables: TableRepository;
}

/** A table with what the relay counted of it. */
export interface TableView {
  readonly table: Table;
  readonly usage: TableUsage;
}

/** How a row is named by a call that changes or deletes it. */
export type RowTarget =
  { readonly rowId: string } | { readonly key: Readonly<Record<string, unknown>> };

/** What one call wrote, by row. */
export interface RowsWritten {
  readonly operationId: string;
  readonly inserted: string[];
  readonly updated: string[];
  readonly deleted: string[];
}

/**
 * A table named by its identifier or by its name, which is how a note and an
 * agent name it. An identifier is tried first, because a name may look like one.
 */
export async function resolveTable(
  deps: TableDependencies,
  notebookId: NotebookId,
  reference: string,
): Promise<Result<Table, DomainError>> {
  const id = TableId.create(reference);
  if (id.ok) {
    const found = await deps.tables.findById(notebookId, id.value);
    if (found) return ok(found);
  }
  const named = await deps.tables.findByName(notebookId, reference);
  return named ? ok(named) : err(DomainError.notFound(`This notebook has no table "${reference}"`));
}

export class CreateTable {
  constructor(private readonly deps: TableDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    name: string;
    description: string;
    schema: unknown;
    key: readonly string[] | null;
    by: Authorship;
  }): Promise<Result<Table, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'maintain');
    if (!notebook.ok) return notebook;

    const read = readSchema(input.schema);
    if (!read.ok) return read;

    const existing = await this.deps.tables.list(input.notebookId);
    if (existing.length >= TABLE_LIMITS.tablesPerNotebook) {
      return err(
        DomainError.limitExceeded(
          `A notebook holds up to ${TABLE_LIMITS.tablesPerNotebook} tables`,
        ),
      );
    }

    const table = Table.create({
      id: TableId.generate(),
      subscriptionId: notebook.value.subscriptionId,
      notebookId: input.notebookId,
      name: input.name,
      description: input.description || read.value.description || '',
      columns: read.value.columns,
      key: input.key,
      by: input.by,
    });
    if (!table.ok) return table;

    // The name is checked here to answer well, and guarded in the write to
    // answer correctly, as a file name is.
    const held = await this.deps.tables.findByName(input.notebookId, table.value.name);
    if (held) {
      return err(
        DomainError.conflict(
          `This notebook already has a table called "${held.name}"`,
          held.id.value,
        ),
      );
    }
    const saved = await this.deps.tables.save(table.value);
    if (!saved.ok) return saved;
    return ok(table.value);
  }
}

export class ListTables {
  constructor(private readonly deps: TableDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
  }): Promise<Result<TableView[], DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;
    const tables = await this.deps.tables.list(input.notebookId);
    const usage = await Promise.all(tables.map((table) => this.deps.tables.usage(table)));
    return ok(
      tables.map((table, index) => ({ table, usage: usage[index] ?? { rows: 0, bytes: 0 } })),
    );
  }
}

export class GetTable {
  constructor(private readonly deps: TableDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    table: string;
  }): Promise<Result<TableView, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;
    const table = await resolveTable(this.deps, input.notebookId, input.table);
    if (!table.ok) return table;
    return ok({ table: table.value, usage: await this.deps.tables.usage(table.value) });
  }
}

/** Whether a change reads or rewrites the rows, so the table has to be held. */
function touchesRows(change: TableChange): boolean {
  return change.op !== 'rename-table' && change.op !== 'describe' && change.op !== 'rename-column';
}

export class AlterTable {
  constructor(private readonly deps: TableDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    table: string;
    changes: readonly TableChange[];
    by: Authorship;
  }): Promise<Result<{ table: Table; changes: string[] }, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'maintain');
    if (!notebook.ok) return notebook;
    const table = await resolveTable(this.deps, input.notebookId, input.table);
    if (!table.ok) return table;

    const renamed = input.changes.findLast((change) => change.op === 'rename-table');
    if (renamed && renamed.op === 'rename-table') {
      const held = await this.deps.tables.findByName(
        input.notebookId,
        renamed.to.normalize('NFC').trim(),
      );
      if (held && held.id.value !== table.value.id.value) {
        return err(
          DomainError.conflict(
            `This notebook already has a table called "${held.name}"`,
            held.id.value,
          ),
        );
      }
    }

    if (!input.changes.some(touchesRows)) {
      const planned = table.value.alter(input.changes, [], input.by);
      if (!planned.ok) return planned;
      const saved = await this.deps.tables.save(planned.value.table);
      if (!saved.ok) return saved;
      return ok({ table: planned.value.table, changes: planned.value.changes });
    }

    // Held first and read second, so no row lands between the read and the
    // rewrite: a row written meanwhile would be lost with the old generation.
    const locked = await this.deps.tables.lock(table.value);
    if (!locked.ok) return locked;
    const rows = await this.deps.tables.rows(locked.value);
    const planned = locked.value.alter(input.changes, rows, input.by);
    if (!planned.ok) {
      await this.deps.tables.unlock(locked.value);
      return planned;
    }

    const grown = planned.value.rows
      ? planned.value.rows.reduce((sum, row) => sum + rowBytes(row.values), 0) -
        rows.reduce((sum, row) => sum + rowBytes(row.values), 0)
      : 0;
    if (grown > 0) {
      const admitted = admitWrite(await this.deps.storage.current(), grown);
      if (!admitted.ok) {
        await this.deps.tables.unlock(locked.value);
        return admitted;
      }
    }

    const written = planned.value.rows
      ? await this.deps.tables.replaceRows(planned.value.table, planned.value.rows)
      : await this.deps.tables.save(planned.value.table);
    if (!written.ok) {
      await this.deps.tables.unlock(locked.value);
      return written;
    }
    return ok({ table: planned.value.table, changes: planned.value.changes });
  }
}

export class DeleteTable {
  constructor(private readonly deps: TableDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    table: string;
    by: Authorship;
  }): Promise<Result<{ rows: number }, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'maintain');
    if (!notebook.ok) return notebook;
    const table = await resolveTable(this.deps, input.notebookId, input.table);
    if (!table.ok) return table;

    // Counted from the rows themselves, so the bytes that leave the count are
    // the bytes the table holds, whatever the relay has caught up with.
    const rows = await this.deps.tables.rows(table.value);
    const bytes = rows.reduce((sum, row) => sum + rowBytes(row.values), 0);
    const deleted = table.value.delete(rows.length, bytes, input.by, Instant.now());
    if (!deleted.ok) return deleted;
    const saved = await this.deps.tables.save(table.value);
    if (!saved.ok) return saved;
    return ok({ rows: rows.length });
  }
}

export class QueryTable {
  constructor(private readonly deps: TableDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    table: string;
    where: string | null;
    sort: readonly RowOrder[];
    page: number;
    pageSize: number | null;
    all?: boolean;
    /** Add the rows up instead of, or beside, reading them (#368). */
    aggregate?:
      { group?: string | null | undefined; measures: readonly string[] } | null | undefined;
  }): Promise<
    Result<{ table: Table; page: RowPage; groups: AggregateGroup[] | null }, DomainError>
  > {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;
    const table = await resolveTable(this.deps, input.notebookId, input.table);
    if (!table.ok) return table;

    const filter = compileFilter(table.value.columns, input.where);
    if (!filter.ok) return filter;
    const order = checkOrder(table.value.columns, input.sort);
    if (!order.ok) return order;

    const asked = input.aggregate ? readAggregate(table.value.columns, input.aggregate) : null;
    if (asked && !asked.ok) return asked;

    const rows = await this.deps.tables.rows(table.value);
    let groups: AggregateGroup[] | null = null;
    if (asked) {
      const counted = aggregate(filter.value ? rows.filter(filter.value) : rows, asked.value);
      if (!counted.ok) return counted;
      groups = counted.value;
    }
    return ok({
      table: table.value,
      groups,
      page: pageOf(table.value.columns, rows, filter.value, {
        where: input.where,
        sort: input.sort,
        page: input.page,
        pageSize: input.pageSize ?? DEFAULT_PAGE_SIZE,
        all: input.all ?? false,
      }),
    });
  }
}

/**
 * The values of one row as the caller wrote them, by column name, checked
 * against the schema and keyed by column identifier.
 */
function valuesOf(
  table: Table,
  given: Readonly<Record<string, unknown>>,
  strict: boolean,
  where: string,
): Result<Record<string, CellValue | null>, DomainError> {
  const values: Record<string, CellValue | null> = {};
  for (const [name, raw] of Object.entries(given)) {
    const column = table.column(name);
    if (!column) {
      return err(DomainError.validation(`${where}: the table has no column "${name}"`));
    }
    if (raw === null || raw === undefined) {
      values[column.id] = null;
      continue;
    }
    const value = cellOf(column, raw, strict);
    if (!value.ok) return err(DomainError.validation(`${where}: ${value.error.message}`));
    values[column.id] = value.value;
  }
  return ok(values);
}

/** A whole row: the defaults of what it left out, and every required value held. */
function completeRow(
  table: Table,
  values: Record<string, CellValue | null>,
  where: string,
): Result<Record<string, CellValue>, DomainError> {
  const row: Record<string, CellValue> = {};
  for (const column of table.columns) {
    const value = values[column.id];
    if (value !== undefined && value !== null) row[column.id] = value;
    else if (value === undefined && column.default !== null) row[column.id] = column.default;
    else if (column.required) {
      return err(DomainError.validation(`${where}: "${column.name}" is required`));
    }
  }
  if (rowBytes(row) > TABLE_LIMITS.rowBytes) {
    return err(DomainError.validation(`${where}: a row goes up to ${TABLE_LIMITS.rowBytes} bytes`));
  }
  return ok(row);
}

/**
 * Every row of a file checked against the table before any is written, and the
 * key of each told apart from the others (#366): the first rows that do not
 * fit, by their line in the file, refuse the import whole.
 */
export function rowsChecked(
  table: Table,
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  strict: boolean,
): Result<void, DomainError> {
  const refused: string[] = [];
  const seen = new Map<string, number>();
  for (const [index, given] of rows.entries()) {
    // The header is line 1, so a row is the line after its place.
    const where = `Line ${index + 2}`;
    const values = valuesOf(table, given, strict, where);
    const full = values.ok ? completeRow(table, values.value, where) : values;
    if (!full.ok) {
      refused.push(full.error.message);
    } else if (table.key) {
      if (!hasKey(table.key, full.value)) {
        refused.push(`${where}: the key ${table.keyNames?.join(', ')} needs a value`);
      } else {
        const rowId = rowIdOf(table.key, full.value);
        const earlier = seen.get(rowId);
        if (earlier !== undefined) refused.push(`${where} repeats the key of line ${earlier}`);
        else seen.set(rowId, index + 2);
      }
    }
    if (refused.length >= 20) break;
  }
  if (refused.length === 0) return ok(undefined);
  return err(
    DomainError.validation(
      `The file does not fit the table "${table.name}": ${refused.join('; ')}`,
    ),
  );
}

function checkBatch(count: number): Result<void, DomainError> {
  if (count === 0) return err(DomainError.validation('A call writes at least one row'));
  if (count > TABLE_LIMITS.rowsPerCall) {
    return err(DomainError.limitExceeded(`A call writes up to ${TABLE_LIMITS.rowsPerCall} rows`));
  }
  return ok(undefined);
}

async function writable(
  deps: TableDependencies,
  ctx: RequestContext,
  notebookId: NotebookId,
  reference: string,
): Promise<Result<Table, DomainError>> {
  const notebook = await loadAuthorized(deps, ctx, notebookId, 'write-content');
  if (!notebook.ok) return notebook;
  const table = await resolveTable(deps, notebookId, reference);
  if (!table.ok) return table;
  if (table.value.isLocked(Instant.now())) {
    return err(
      DomainError.conflict('The table is being altered: write its rows again in a moment'),
    );
  }
  return table;
}

export class InsertRows {
  constructor(private readonly deps: TableDependencies) {}

  /**
   * `insert` refuses a row whose key the table already holds, naming it;
   * `upsert` changes that row instead, with the columns given and the rest
   * kept. A table with no key takes every row as a new one (RN-KNW-068).
   * `strict` is false only for a file, whose values all arrived as text.
   */
  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    table: string;
    rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
    mode: 'insert' | 'upsert';
    by: Authorship;
    operationId?: string;
    strict?: boolean;
  }): Promise<Result<RowsWritten, DomainError>> {
    const batch = checkBatch(input.rows.length);
    if (!batch.ok) return batch;
    const table = await writable(this.deps, input.ctx, input.notebookId, input.table);
    if (!table.ok) return table;
    const key = table.value.key;

    const planned: Array<{
      rowId: string;
      given: Record<string, CellValue | null>;
      full: Record<string, CellValue>;
    }> = [];
    const seen = new Set<string>();
    for (const [index, given] of input.rows.entries()) {
      const where = `Row ${index + 1}`;
      const values = valuesOf(table.value, given, input.strict ?? true, where);
      if (!values.ok) return values;
      const full = completeRow(table.value, values.value, where);
      if (!full.ok) return full;
      if (key && !hasKey(key, full.value)) {
        return err(
          DomainError.validation(
            `${where}: the key ${table.value.keyNames?.join(', ')} needs a value`,
          ),
        );
      }
      const rowId = rowIdOf(key, full.value);
      if (seen.has(rowId))
        return err(
          DomainError.validation(`${where} repeats the key of an earlier row of this call`),
        );
      seen.add(rowId);
      planned.push({ rowId, given: values.value, full: full.value });
    }

    const existing = key
      ? new Map(
          (await this.deps.tables.findRows(table.value, [...seen])).map((row) => [row.rowId, row]),
        )
      : new Map<string, Row>();
    if (input.mode === 'insert' && existing.size > 0) {
      return err(
        DomainError.conflict(
          `The table already holds a row with the key of ${[...existing.keys()].length} of these rows: use upsert to change them`,
        ),
      );
    }

    const usage = await this.deps.tables.usage(table.value);
    const inserting = planned.filter((each) => !existing.has(each.rowId)).length;
    if (usage.rows + inserting > TABLE_LIMITS.rows) {
      return err(
        DomainError.limitExceeded(
          `A table holds up to ${TABLE_LIMITS.rows} rows, and this one holds ${usage.rows}`,
        ),
      );
    }

    const now = input.by;
    const writes: RowWrite[] = [];
    const inserted: Array<{ rowId: string; columns: string[] }> = [];
    const updated: Array<{ rowId: string; columns: string[] }> = [];
    let added = 0;
    let changed = 0;
    for (const each of planned) {
      const held = existing.get(each.rowId);
      if (!held) {
        const row: Row = {
          rowId: each.rowId,
          values: each.full,
          seq: ulid(),
          createdBy: now,
          updatedBy: now,
          version: 0,
        };
        writes.push({ kind: 'insert', row });
        inserted.push({ rowId: row.rowId, columns: Object.keys(row.values) });
        added += rowBytes(row.values);
        continue;
      }
      const merged: Record<string, CellValue> = { ...held.values };
      for (const [id, value] of Object.entries(each.given)) {
        if (value === null) delete merged[id];
        else merged[id] = value;
      }
      const complete = completeRow(table.value, merged, `The row ${held.rowId}`);
      if (!complete.ok) return complete;
      writes.push({
        kind: 'replace',
        row: { ...held, values: complete.value, updatedBy: now },
        expectedVersion: held.version,
      });
      updated.push({ rowId: held.rowId, columns: Object.keys(each.given) });
      changed += rowBytes(complete.value) - rowBytes(held.values);
    }

    const admitted = admitWrite(await this.deps.storage.current(), added + changed);
    if (!admitted.ok) return admitted;

    const operationId = input.operationId ?? ulid();
    const events = [
      ...(inserted.length > 0
        ? [table.value.rowsEvent('RowsInserted', input.by, operationId, inserted, added)]
        : []),
      ...(updated.length > 0
        ? [table.value.rowsEvent('RowsUpdated', input.by, operationId, updated, changed)]
        : []),
    ];
    const written = await this.deps.tables.writeRows(table.value, writes, events);
    if (!written.ok) return written;
    return ok({
      operationId,
      inserted: inserted.map((each) => each.rowId),
      updated: updated.map((each) => each.rowId),
      deleted: [],
    });
  }
}

/** The rows a list of targets names, refusing the first one the table does not hold. */
async function rowsNamed(
  deps: TableDependencies,
  table: Table,
  targets: readonly RowTarget[],
): Promise<Result<Row[], DomainError>> {
  const ids: string[] = [];
  for (const [index, target] of targets.entries()) {
    if ('rowId' in target) {
      ids.push(target.rowId);
      continue;
    }
    if (!table.key) {
      return err(
        DomainError.validation(
          `Target ${index + 1} names a key, and the table has none: name the row by rowId`,
        ),
      );
    }
    const values = valuesOf(table, target.key, true, `Target ${index + 1}`);
    if (!values.ok) return values;
    const held = Object.fromEntries(
      Object.entries(values.value).filter(
        (entry): entry is [string, CellValue] => entry[1] !== null,
      ),
    );
    if (!hasKey(table.key, held)) {
      return err(
        DomainError.validation(
          `Target ${index + 1} gives part of the key ${table.keyNames?.join(', ')}`,
        ),
      );
    }
    ids.push(rowIdOf(table.key, held));
  }
  if (new Set(ids).size !== ids.length)
    return err(DomainError.validation('A call names each row once'));
  const found = await deps.tables.findRows(table, ids);
  const byId = new Map(found.map((row) => [row.rowId, row]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    return err(DomainError.notFound(`The table holds no row ${missing.slice(0, 10).join(', ')}`));
  }
  return ok(ids.map((id) => byId.get(id) as Row));
}

export class UpdateRows {
  constructor(private readonly deps: TableDependencies) {}

  /**
   * Sets the columns given and keeps the rest; `null` clears a column that is
   * not required. A column of the key is never set here: the key names the row,
   * so changing it is deleting one row and inserting another.
   */
  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    table: string;
    updates: ReadonlyArray<{
      readonly target: RowTarget;
      readonly set: Readonly<Record<string, unknown>>;
    }>;
    by: Authorship;
  }): Promise<Result<RowsWritten, DomainError>> {
    const batch = checkBatch(input.updates.length);
    if (!batch.ok) return batch;
    const table = await writable(this.deps, input.ctx, input.notebookId, input.table);
    if (!table.ok) return table;

    const rows = await rowsNamed(
      this.deps,
      table.value,
      input.updates.map((each) => each.target),
    );
    if (!rows.ok) return rows;

    const writes: RowWrite[] = [];
    const updated: Array<{ rowId: string; columns: string[] }> = [];
    let delta = 0;
    for (const [index, update] of input.updates.entries()) {
      const held = rows.value[index] as Row;
      const where = `Update ${index + 1}`;
      const given = valuesOf(table.value, update.set, true, where);
      if (!given.ok) return given;
      const touched = Object.keys(given.value);
      if (touched.length === 0) return err(DomainError.validation(`${where} sets no column`));
      const key = table.value.key ?? [];
      const keyed = touched.find((id) => key.includes(id));
      if (keyed) {
        const name = table.value.columns.find((column) => column.id === keyed)?.name ?? keyed;
        return err(
          DomainError.validation(
            `${where} sets "${name}", which is part of the key: delete the row and insert it again`,
          ),
        );
      }
      const merged: Record<string, CellValue> = { ...held.values };
      for (const [id, value] of Object.entries(given.value)) {
        if (value === null) delete merged[id];
        else merged[id] = value;
      }
      const complete = completeRow(table.value, merged, where);
      if (!complete.ok) return complete;
      writes.push({
        kind: 'replace',
        row: { ...held, values: complete.value, updatedBy: input.by },
        expectedVersion: held.version,
      });
      updated.push({ rowId: held.rowId, columns: touched });
      delta += rowBytes(complete.value) - rowBytes(held.values);
    }

    if (delta > 0) {
      const admitted = admitWrite(await this.deps.storage.current(), delta);
      if (!admitted.ok) return admitted;
    }
    const operationId = ulid();
    const written = await this.deps.tables.writeRows(table.value, writes, [
      table.value.rowsEvent('RowsUpdated', input.by, operationId, updated, delta),
    ]);
    if (!written.ok) return written;
    return ok({
      operationId,
      inserted: [],
      updated: updated.map((each) => each.rowId),
      deleted: [],
    });
  }
}

export class DeleteRows {
  constructor(private readonly deps: TableDependencies) {}

  /** Definitive (INV-08): the trail says which rows went, never what they held. */
  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    table: string;
    targets: readonly RowTarget[];
    by: Authorship;
  }): Promise<Result<RowsWritten, DomainError>> {
    const batch = checkBatch(input.targets.length);
    if (!batch.ok) return batch;
    const table = await writable(this.deps, input.ctx, input.notebookId, input.table);
    if (!table.ok) return table;

    const rows = await rowsNamed(this.deps, table.value, input.targets);
    if (!rows.ok) return rows;
    const freed = rows.value.reduce((sum, row) => sum + rowBytes(row.values), 0);
    const operationId = ulid();
    const written = await this.deps.tables.writeRows(
      table.value,
      rows.value.map((row) => ({ kind: 'delete', rowId: row.rowId, expectedVersion: row.version })),
      [
        table.value.rowsEvent(
          'RowsDeleted',
          input.by,
          operationId,
          rows.value.map((row) => ({ rowId: row.rowId, columns: [] })),
          -freed,
        ),
      ],
    );
    if (!written.ok) return written;
    return ok({
      operationId,
      inserted: [],
      updated: [],
      deleted: rows.value.map((row) => row.rowId),
    });
  }
}

/** Columns named in a request that the table does not have, for one refusal. */
export function unknownColumns(table: Table, names: readonly string[]): string[] {
  return names.filter((name) => !table.columns.some((column) => sameColumnName(column.name, name)));
}
