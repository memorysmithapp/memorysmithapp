import type {
  TablePage,
  TableRequest,
  TableRow,
  TableValue,
} from '@memorysmithapp/markdown-renderer';
import { tableColumnsOf } from '@memorysmithapp/contracts';
import { ApiError } from './error-mapper';
import { queryTable } from './source';

/**
 * A value as the renderer takes it: a number as its decimal digits, never
 * through a float's own text, which writes a large one with an exponent.
 */
function valueOf(value: unknown): TableValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
  }
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  return Array.isArray(value) ? value.map(String) : String(value);
}

/**
 * Answers a `table` block of a note (#366, §7.15): the page it asks for, or
 * every row when a note is printed, the row count, the total over the whole
 * filter and the columns. A table the notebook does not keep answers `null`,
 * which the renderer draws as pending.
 */
export async function answerTableBlock(
  notebookId: string,
  request: TableRequest,
): Promise<TablePage | null> {
  try {
    const answer = await queryTable(notebookId, request.table, {
      where: request.where,
      sort: request.sort.map((key) => ({
        column: key.column,
        direction: key.descending ? 'desc' : 'asc',
      })),
      page: request.page,
      ...(request.size === 'all' ? { all: true } : { pageSize: request.size }),
      ...(request.total ? { aggregate: { measures: [`sum(${request.total})`] } } : {}),
    });
    const columns = tableColumnsOf(answer.table.schema);
    const rows: TableRow[] = answer.rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column.name, valueOf(row.values[column.name])])),
    );
    const total = answer.groups?.[0]?.values[0] ?? null;
    return {
      schema: { name: answer.table.name, columns },
      rows,
      count: answer.total,
      total: total === null ? null : (valueOf(total) as string),
      readAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
