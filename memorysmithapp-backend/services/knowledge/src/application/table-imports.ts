/**
 * Rows from a file the notebook keeps: a CSV or an Excel workbook (#366).
 *
 * The file arrives the way every file does, kept whole through the upload in
 * parts or by a request the person fulfils (RN-PRT-027, RN-PRT-030), and this
 * reads it. Without a table, or with `dryRun`, it writes nothing and answers
 * the schema the sheet suggests and a few rows, for the agent to show the
 * person before anything is created. Into a table, every row of the sheet is
 * checked first, and one that does not fit refuses the whole file naming it,
 * before the first row is written; the rows are then written in calls of 50,
 * every one under the operation of this import.
 */

import {
  type Authorship,
  DomainError,
  err,
  type NotebookId,
  ok,
  type Result,
  ulid,
} from '@memorysmithapp/kernel';
import type { RequestContext } from '../domain/access/AuthorizationPolicy.js';
import type {
  FileRepository,
  FileStore,
  Sheet,
  SheetCell,
  SheetReader,
} from '../domain/ports/index.js';
import { inferColumns, proposedSchema, columnNameOf } from '../domain/table/SchemaInference.js';
import { sameColumnName, TABLE_LIMITS } from '../domain/table/TableSchema.js';
import type { Table } from '../domain/table/Table.js';
import { loadAuthorized } from './notebooks.js';
import { InsertRows, resolveTable, rowsChecked, type TableDependencies } from './tables.js';

export interface TableImportDependencies extends TableDependencies {
  readonly files: FileRepository;
  readonly fileStore: FileStore;
  readonly sheets: SheetReader;
}

export interface SheetProposal {
  readonly sheet: string;
  readonly sheets: string[];
  readonly rows: number;
  readonly schema: Record<string, unknown>;
  /** Which header became which column name. */
  readonly columns: Array<{ header: string; column: string }>;
  readonly sample: Array<Record<string, SheetCell>>;
}

export interface SheetImported {
  readonly operationId: string;
  readonly sheet: string;
  readonly inserted: number;
  readonly updated: number;
}

const SAMPLE_ROWS = 5;

export class ImportTableRows {
  constructor(private readonly deps: TableImportDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    file: string;
    sheet: string | null;
    table: string | null;
    mode: 'insert' | 'upsert';
    dryRun: boolean;
    by: Authorship | null;
  }): Promise<Result<{ proposal: SheetProposal } | { imported: SheetImported }, DomainError>> {
    const writes = input.table !== null && !input.dryRun;
    const notebook = await loadAuthorized(
      this.deps,
      input.ctx,
      input.notebookId,
      writes ? 'write-content' : 'read',
    );
    if (!notebook.ok) return notebook;

    const file = await this.deps.files.findByName(
      input.notebookId,
      input.file.normalize('NFC').trim(),
    );
    if (!file)
      return err(DomainError.notFound(`This notebook keeps no file called "${input.file}"`));
    if (!this.deps.sheets.accepted.includes(file.mimeType)) {
      return err(
        DomainError.validation(
          `Rows are read from a CSV or an Excel file (.xlsx), and "${file.name}" is ${file.mimeType}`,
        ),
      );
    }
    const sheets = await this.deps.sheets.read(
      await this.deps.fileStore.read(file.contentRef),
      file.mimeType,
    );
    if (!sheets.ok) return sheets;
    const sheet = input.sheet
      ? sheets.value.find((each) => each.name === input.sheet)
      : sheets.value[0];
    if (!sheet) {
      return err(
        DomainError.validation(
          `The file has no sheet "${input.sheet}": it has ${sheets.value.map((each) => each.name).join(', ')}`,
        ),
      );
    }
    if (sheet.rows.length > TABLE_LIMITS.rows) {
      return err(
        DomainError.limitExceeded(
          `The sheet holds ${sheet.rows.length} rows, and a table holds up to ${TABLE_LIMITS.rows}`,
        ),
      );
    }

    if (!writes) return ok({ proposal: proposalOf(sheet, sheets.value) });
    if (!input.by) return err(DomainError.validation('An import writes, and needs who it is by'));

    const table = await resolveTable(this.deps, input.notebookId, input.table as string);
    if (!table.ok) return table;
    const rows = rowsOf(table.value, sheet);
    if (!rows.ok) return rows;

    // Every row checked before the first one is written, so a file with one bad
    // line is refused whole instead of half imported.
    const checked = rowsChecked(table.value, rows.value, false);
    if (!checked.ok) return checked;

    const operationId = ulid();
    const insert = new InsertRows(this.deps);
    let inserted = 0;
    let updated = 0;
    for (let index = 0; index < rows.value.length; index += TABLE_LIMITS.rowsPerCall) {
      const written = await insert.execute({
        ctx: input.ctx,
        notebookId: input.notebookId,
        table: table.value.id.value,
        rows: rows.value.slice(index, index + TABLE_LIMITS.rowsPerCall),
        mode: input.mode,
        by: input.by,
        operationId,
        strict: false,
      });
      if (!written.ok) {
        return err(
          DomainError.conflict(
            `The import stopped at row ${index + 1} after writing ${inserted + updated} rows: ${written.error.message}`,
          ),
        );
      }
      inserted += written.value.inserted.length;
      updated += written.value.updated.length;
    }
    return ok({ imported: { operationId, sheet: sheet.name, inserted, updated } });
  }
}

function proposalOf(sheet: Sheet, sheets: readonly Sheet[]): SheetProposal {
  const columns = inferColumns(sheet.header, sheet.rows);
  return {
    sheet: sheet.name,
    sheets: sheets.map((each) => each.name),
    rows: sheet.rows.length,
    schema: proposedSchema(columns),
    columns: columns.map((column) => ({ header: column.header, column: column.name })),
    sample: sheet.rows
      .slice(0, SAMPLE_ROWS)
      .map((row) =>
        Object.fromEntries(columns.map((column, index) => [column.name, row[index] ?? null])),
      ),
  };
}

/**
 * The rows of a sheet by column name: each header is the column it names, as
 * written or as it becomes one word, and a header the table has no column for
 * refuses the file, naming it, so no value is dropped in silence.
 */
function rowsOf(table: Table, sheet: Sheet): Result<Array<Record<string, SheetCell>>, DomainError> {
  const taken = new Set<string>();
  const names: string[] = [];
  const unknown: string[] = [];
  for (const [index, header] of sheet.header.entries()) {
    const column =
      table.columns.find((each) => sameColumnName(each.name, header)) ??
      table.columns.find((each) => sameColumnName(each.name, columnNameOf(header, index, taken)));
    if (!column) unknown.push(header || `column ${index + 1}`);
    else names.push(column.name);
  }
  if (unknown.length > 0) {
    return err(
      DomainError.validation(
        `The table "${table.name}" has no column for ${unknown.map((each) => `"${each}"`).join(', ')}: add it with alter_table, or remove it from the file`,
      ),
    );
  }
  return ok(
    sheet.rows.map((row) =>
      Object.fromEntries(
        names
          .map((name, index) => [name, row[index] ?? null] as const)
          .filter(([, value]) => value !== null && value !== ''),
      ),
    ),
  );
}
