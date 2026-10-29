/**
 * The HTTP surface of the Tables of a notebook (#366).
 *
 * A table is named in the path by its identifier or by its name, URL-encoded,
 * which is how a note and an agent name it. The bodies are read with the
 * contracts the interface and the connector share; what a schema may say is
 * decided by the domain, which names what it refuses.
 */

import type { Context, Hono } from 'hono';
import {
  alterTableRequestSchema,
  createTableRequestSchema,
  deleteRowsRequestSchema,
  importTableRequestSchema,
  insertRowsRequestSchema,
  type NotebookTableDto,
  tableQueryRequestSchema,
  updateRowsRequestSchema,
} from '@memorysmithapp/contracts';
import { type Authorship, DomainError, NotebookId, type Result } from '@memorysmithapp/kernel';
import type { RequestContext } from '../../../domain/access/AuthorizationPolicy.js';
import type { ImportTableRows } from '../../../application/table-imports.js';
import type {
  AlterTable,
  CreateTable,
  DeleteRows,
  DeleteTable,
  GetTable,
  InsertRows,
  ListTables,
  QueryTable,
  TableView,
  UpdateRows,
} from '../../../application/tables.js';
import type { TableUsage } from '../../../domain/ports/index.js';
import type { Row } from '../../../domain/table/Row.js';
import type { Table } from '../../../domain/table/Table.js';
import { presentCell, tableSchema } from '../../../domain/table/TableSchema.js';

/**
 * What a route of a table reads off the request, which the knowledge request
 * carries: said here rather than imported, so these routes and the ones that
 * register them do not import each other.
 */
export interface TableRequest {
  readonly ctx: RequestContext;
  readonly authorship: Result<Authorship, DomainError>;
}

export interface TableUseCases<KnowledgeRequest extends TableRequest = TableRequest> {
  readonly listTables: (request: KnowledgeRequest) => ListTables;
  readonly createTable: (request: KnowledgeRequest) => CreateTable;
  readonly getTable: (request: KnowledgeRequest) => GetTable;
  readonly alterTable: (request: KnowledgeRequest) => AlterTable;
  readonly deleteTable: (request: KnowledgeRequest) => DeleteTable;
  readonly queryTable: (request: KnowledgeRequest) => QueryTable;
  readonly insertRows: (request: KnowledgeRequest) => InsertRows;
  readonly updateRows: (request: KnowledgeRequest) => UpdateRows;
  readonly deleteRows: (request: KnowledgeRequest) => DeleteRows;
  readonly importTableRows: (request: KnowledgeRequest) => ImportTableRows;
}

type Fail = (c: Context, error: DomainError) => Response;

export function tableToDto(table: Table, usage: TableUsage): NotebookTableDto {
  return {
    tableId: table.id.value,
    notebookId: table.notebookId.value,
    name: table.name,
    description: table.description,
    schema: tableSchema(table.columns),
    key: table.keyNames,
    rows: usage.rows,
    bytes: usage.bytes,
    updatedAt: table.updatedBy.at.toISOString(),
    authorship: table.updatedBy.toJSON(),
  };
}

/** A row by column name, its numbers as numbers where no digit is lost. */
export function rowToDto(
  table: Table,
  row: Row,
): { rowId: string; values: Record<string, unknown> } {
  const values: Record<string, unknown> = {};
  for (const column of table.columns) {
    const value = row.values[column.id];
    if (value !== undefined) values[column.name] = presentCell(column, value);
  }
  return { rowId: row.rowId, values };
}

function viewToDto(view: TableView): NotebookTableDto {
  return tableToDto(view.table, view.usage);
}

/** What a contract offers to read a body with, without importing its library here. */
interface BodySchema<T> {
  safeParse(value: unknown):
    | { success: true; data: T }
    | {
        success: false;
        error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> };
      };
}

async function bodyOf<T>(c: Context, schema: BodySchema<T>): Promise<Result<T, DomainError>> {
  const raw = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.map(String).join('.')}: ` : '';
    return {
      ok: false,
      error: DomainError.validation(`${where}${issue?.message ?? 'The request is not readable'}`),
    };
  }
  return { ok: true, value: parsed.data };
}

export function registerTableRoutes<R extends TableRequest>(
  app: Hono<{ Variables: { knowledge: R } }>,
  useCases: TableUseCases<R>,
  fail: Fail,
): void {
  const notebookOf = (c: Context): Result<NotebookId, DomainError> =>
    NotebookId.create(c.req.param('v') ?? '');
  const tableOf = (c: Context): string => decodeURIComponent(c.req.param('t') ?? '');

  app.get('/notebooks/:v/tables', async (c) => {
    const request = c.get('knowledge');
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const listed = await useCases
      .listTables(request)
      .execute({ ctx: request.ctx, notebookId: notebookId.value });
    return listed.ok ? c.json({ tables: listed.value.map(viewToDto) }) : fail(c, listed.error);
  });

  app.post('/notebooks/:v/tables', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = await bodyOf(c, createTableRequestSchema);
    if (!body.ok) return fail(c, body.error);

    const created = await useCases.createTable(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      name: body.value.name,
      description: body.value.description,
      schema: body.value.schema,
      key: body.value.key,
      by: author.value,
    });
    return created.ok
      ? c.json(tableToDto(created.value, { rows: 0, bytes: 0 }), 201)
      : fail(c, created.error);
  });

  /**
   * Rows from a CSV or an Excel file the notebook keeps. A dry run writes
   * nothing and needs no authorship, so a reader can ask what a file holds.
   */
  app.post('/notebooks/:v/tables/import', async (c) => {
    const request = c.get('knowledge');
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = await bodyOf(c, importTableRequestSchema);
    if (!body.ok) return fail(c, body.error);
    const writes = body.value.table !== null && !body.value.dryRun;
    if (writes && !request.authorship.ok) return fail(c, request.authorship.error);

    const answered = await useCases.importTableRows(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      file: body.value.file,
      sheet: body.value.sheet,
      table: body.value.table,
      mode: body.value.mode,
      dryRun: body.value.dryRun,
      by: request.authorship.ok ? request.authorship.value : null,
    });
    return answered.ok ? c.json(answered.value, writes ? 201 : 200) : fail(c, answered.error);
  });

  app.get('/notebooks/:v/tables/:t', async (c) => {
    const request = c.get('knowledge');
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const found = await useCases
      .getTable(request)
      .execute({ ctx: request.ctx, notebookId: notebookId.value, table: tableOf(c) });
    return found.ok ? c.json(viewToDto(found.value)) : fail(c, found.error);
  });

  app.patch('/notebooks/:v/tables/:t', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = await bodyOf(c, alterTableRequestSchema);
    if (!body.ok) return fail(c, body.error);

    const altered = await useCases.alterTable(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      table: tableOf(c),
      changes: body.value.changes,
      by: author.value,
    });
    if (!altered.ok) return fail(c, altered.error);
    const view = await useCases.getTable(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      table: altered.value.table.id.value,
    });
    const usage = view.ok ? view.value.usage : { rows: 0, bytes: 0 };
    return c.json({
      table: tableToDto(altered.value.table, usage),
      changes: altered.value.changes,
    });
  });

  app.delete('/notebooks/:v/tables/:t', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const deleted = await useCases.deleteTable(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      table: tableOf(c),
      by: author.value,
    });
    return deleted.ok ? c.json(deleted.value) : fail(c, deleted.error);
  });

  app.post('/notebooks/:v/tables/:t/query', async (c) => {
    const request = c.get('knowledge');
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = await bodyOf(c, tableQueryRequestSchema);
    if (!body.ok) return fail(c, body.error);

    const answered = await useCases.queryTable(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      table: tableOf(c),
      where: body.value.where,
      sort: body.value.sort,
      page: body.value.page,
      pageSize: body.value.pageSize,
    });
    if (!answered.ok) return fail(c, answered.error);
    const { table, page } = answered.value;
    const view = await useCases
      .getTable(request)
      .execute({ ctx: request.ctx, notebookId: notebookId.value, table: table.id.value });
    return c.json({
      table: tableToDto(table, view.ok ? view.value.usage : { rows: page.total, bytes: 0 }),
      rows: page.rows.map((row) => rowToDto(table, row)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    });
  });

  app.post('/notebooks/:v/tables/:t/rows', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = await bodyOf(c, insertRowsRequestSchema);
    if (!body.ok) return fail(c, body.error);

    const written = await useCases.insertRows(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      table: tableOf(c),
      rows: body.value.rows,
      mode: body.value.mode,
      by: author.value,
    });
    return written.ok ? c.json(written.value, 201) : fail(c, written.error);
  });

  app.patch('/notebooks/:v/tables/:t/rows', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = await bodyOf(c, updateRowsRequestSchema);
    if (!body.ok) return fail(c, body.error);

    const written = await useCases.updateRows(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      table: tableOf(c),
      updates: body.value.updates,
      by: author.value,
    });
    return written.ok ? c.json(written.value) : fail(c, written.error);
  });

  /** A POST and not a DELETE with a body, which proxies are free to drop. */
  app.post('/notebooks/:v/tables/:t/rows/delete', async (c) => {
    const request = c.get('knowledge');
    const author = request.authorship;
    if (!author.ok) return fail(c, author.error);
    const notebookId = notebookOf(c);
    if (!notebookId.ok) return fail(c, notebookId.error);
    const body = await bodyOf(c, deleteRowsRequestSchema);
    if (!body.ok) return fail(c, body.error);

    const written = await useCases.deleteRows(request).execute({
      ctx: request.ctx,
      notebookId: notebookId.value,
      table: tableOf(c),
      targets: body.value.targets,
      by: author.value,
    });
    return written.ok ? c.json(written.value) : fail(c, written.error);
  });
}
