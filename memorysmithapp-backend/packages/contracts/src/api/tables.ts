/**
 * The Tables of a notebook (#366): a schema in a subset of JSON Schema, an
 * optional key, and rows read through a filter in the search query language.
 *
 * The schema travels as JSON Schema both ways, so what an agent wrote is what
 * it reads back; its subset is checked by Knowledge, which names the keyword it
 * refuses (RN-KNW-067). Here it is an object and nothing more.
 */

import { z } from 'zod';
import { authorshipSchema, instantSchema, ulidSchema } from '../common.js';

export const tableSchemaDocument = z.record(z.string(), z.unknown());

export const notebookTableSchema = z.object({
  tableId: ulidSchema,
  notebookId: ulidSchema,
  name: z.string().min(1).max(64),
  description: z.string().max(500),
  schema: tableSchemaDocument,
  /** The columns that name a row, or `null` when rows have no key. */
  key: z.array(z.string()).nullable(),
  /** As the relay counted them (ADR-010): a write may take a moment to show. */
  rows: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  updatedAt: instantSchema,
  authorship: authorshipSchema,
});

export const tableListSchema = z.object({ tables: z.array(notebookTableSchema) });

export const createTableRequestSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).default(''),
  schema: tableSchemaDocument,
  key: z.array(z.string()).nullable().default(null),
});

/** One change of an alteration, by the names of the table and its columns. */
export const tableChangeSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('rename-table'), to: z.string() }),
  z.object({ op: z.literal('describe'), description: z.string() }),
  z.object({
    op: z.literal('add-column'),
    name: z.string(),
    schema: z.record(z.string(), z.unknown()),
    required: z.boolean().optional(),
  }),
  z.object({ op: z.literal('rename-column'), column: z.string(), to: z.string() }),
  z.object({ op: z.literal('remove-column'), column: z.string() }),
  z.object({
    op: z.literal('change-column'),
    column: z.string(),
    schema: z.record(z.string(), z.unknown()),
    required: z.boolean().optional(),
  }),
  z.object({ op: z.literal('set-key'), columns: z.array(z.string()).nullable() }),
]);

export const alterTableRequestSchema = z.object({ changes: z.array(tableChangeSchema).min(1) });

export const tableAlteredSchema = z.object({
  table: notebookTableSchema,
  changes: z.array(z.string()),
});

export const rowOrderSchema = z.object({
  column: z.string().min(1),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

export const tableQueryRequestSchema = z.object({
  where: z.string().max(500).nullable().default(null),
  sort: z.array(rowOrderSchema).max(5).default([]),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).nullable().default(null),
});

/** A row as an answer carries it: values by column name. */
export const tableRowSchema = z.object({
  rowId: z.string().min(1),
  values: z.record(z.string(), z.unknown()),
});

export const tablePageSchema = z.object({
  table: notebookTableSchema,
  rows: z.array(tableRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

/** How a call names a row it changes or deletes: its identifier, or its key. */
export const rowTargetSchema = z.union([
  z.object({ rowId: z.string().min(1) }),
  z.object({ key: z.record(z.string(), z.unknown()) }),
]);

export const insertRowsRequestSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(50),
  mode: z.enum(['insert', 'upsert']).default('insert'),
});

export const updateRowsRequestSchema = z.object({
  updates: z
    .array(z.object({ target: rowTargetSchema, set: z.record(z.string(), z.unknown()) }))
    .min(1)
    .max(50),
});

export const deleteRowsRequestSchema = z.object({
  targets: z.array(rowTargetSchema).min(1).max(50),
});

export const rowsWrittenSchema = z.object({
  operationId: z.string().min(1),
  inserted: z.array(z.string()),
  updated: z.array(z.string()),
  deleted: z.array(z.string()),
});

/**
 * Rows from a CSV or an Excel file the notebook keeps (#366). With no table, or
 * with `dryRun`, nothing is written and the answer is the schema the sheet
 * suggests; with a table, every row is checked and then written.
 */
export const importTableRequestSchema = z.object({
  file: z.string().min(1),
  sheet: z.string().min(1).nullable().default(null),
  table: z.string().min(1).nullable().default(null),
  mode: z.enum(['insert', 'upsert']).default('insert'),
  dryRun: z.boolean().default(false),
});

export const tableImportSchema = z.union([
  z.object({
    proposal: z.object({
      sheet: z.string(),
      sheets: z.array(z.string()),
      rows: z.number().int().nonnegative(),
      schema: tableSchemaDocument,
      columns: z.array(z.object({ header: z.string(), column: z.string() })),
      sample: z.array(z.record(z.string(), z.unknown())),
    }),
  }),
  z.object({
    imported: z.object({
      operationId: z.string(),
      sheet: z.string(),
      inserted: z.number().int().nonnegative(),
      updated: z.number().int().nonnegative(),
    }),
  }),
]);

export type ImportTableRequest = z.infer<typeof importTableRequestSchema>;
export type TableImportDto = z.infer<typeof tableImportSchema>;
export type NotebookTableDto = z.infer<typeof notebookTableSchema>;
export type TableListDto = z.infer<typeof tableListSchema>;
export type CreateTableRequest = z.infer<typeof createTableRequestSchema>;
export type TableChangeDto = z.infer<typeof tableChangeSchema>;
export type AlterTableRequest = z.infer<typeof alterTableRequestSchema>;
export type TableAlteredDto = z.infer<typeof tableAlteredSchema>;
export type TableQueryRequest = z.infer<typeof tableQueryRequestSchema>;
export type TableRowDto = z.infer<typeof tableRowSchema>;
export type TablePageDto = z.infer<typeof tablePageSchema>;
export type RowTargetDto = z.infer<typeof rowTargetSchema>;
export type InsertRowsRequest = z.infer<typeof insertRowsRequestSchema>;
export type UpdateRowsRequest = z.infer<typeof updateRowsRequestSchema>;
export type DeleteRowsRequest = z.infer<typeof deleteRowsRequestSchema>;
export type RowsWrittenDto = z.infer<typeof rowsWrittenSchema>;
