/**
 * Reading the rows of a Table (#366, RN-KNW-073): a filter in the search query
 * language, an order, a page.
 *
 * The grammar is the search's own, from the kernel (RN-DSC-026, RN-DSC-034);
 * what changes is what a field means. A field is a column, and the column's
 * type decides how a value matches it: text by substring with case and accents
 * ignored (RN-DSC-025), a number by its value, a date by prefix, so
 * `date:2026-10` is October. A bare word looks in every column that holds
 * text. An interval asks a number or a date and nothing else.
 *
 * A filter that names a column the table does not have is refused naming it,
 * and not answered with nothing: a search over a notebook asks what may be
 * there, and a filter over a table asks what its schema says is there.
 *
 * The whole table is read and filtered here, which is the trade-off ADR-012
 * takes for the search: a table holds at most 10,000 rows (PRD §8), and at
 * that size reading them costs less than an index would to keep.
 */

import {
  type Comparison,
  DomainError,
  err,
  normalize,
  ok,
  parseQuery,
  type QueryNode,
  QuerySyntaxError,
  type Result,
} from '@memorysmithapp/kernel';
import type { Row } from './Row.js';
import {
  canonicalDecimal,
  type CellValue,
  type Column,
  compareDecimal,
  sameColumnName,
} from './TableSchema.js';

export interface RowOrder {
  readonly column: string;
  readonly direction: 'asc' | 'desc';
}

export interface RowRequest {
  readonly where: string | null;
  readonly sort: readonly RowOrder[];
  readonly page: number;
  readonly pageSize: number;
  /** Every row the filter returns, for a printed note (§7.15). */
  readonly all?: boolean;
}

export interface RowPage {
  readonly rows: Row[];
  /** How many rows the filter matched, over every page. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** A filter, read and checked against the columns it names. */
export function compileFilter(
  columns: readonly Column[],
  where: string | null,
): Result<((row: Row) => boolean) | null, DomainError> {
  if (where === null || where.trim().length === 0) return ok(null);
  let tree: QueryNode;
  try {
    tree = parseQuery(where);
  } catch (error) {
    if (error instanceof QuerySyntaxError) return err(DomainError.validation(error.message));
    throw error;
  }
  const checked = check(columns, tree);
  if (!checked.ok) return checked;
  return ok((row: Row) => evaluate(columns, tree, row));
}

function columnNamed(columns: readonly Column[], field: string): Column | undefined {
  return columns.find((column) => sameColumnName(normalize(column.name), field));
}

function check(columns: readonly Column[], node: QueryNode): Result<void, DomainError> {
  switch (node.kind) {
    case 'term':
      if (node.field !== null && !columnNamed(columns, node.field)) return unknown(node.field);
      return ok(undefined);
    case 'facet':
      return columnNamed(columns, node.facet) ? ok(undefined) : unknown(node.facet);
    case 'compare': {
      const column = columnNamed(columns, node.facet);
      if (!column) return unknown(node.facet);
      if (!orderable(column)) {
        return err(
          DomainError.validation(
            `"${column.name}" holds ${column.type === 'list' ? 'a list' : 'text'}, and an interval asks a number or a date`,
          ),
        );
      }
      if (
        (column.type === 'number' || column.type === 'integer') &&
        canonicalDecimal(node.value) === null
      ) {
        return err(
          DomainError.validation(
            `"${node.value}" is not a number to compare "${column.name}" with`,
          ),
        );
      }
      return ok(undefined);
    }
    case 'not':
      return check(columns, node.node);
    case 'and':
    case 'or':
      for (const each of node.nodes) {
        const checked = check(columns, each);
        if (!checked.ok) return checked;
      }
      return ok(undefined);
  }
}

function unknown(field: string): Result<never, DomainError> {
  return err(DomainError.validation(`The table has no column "${field}" to filter by`));
}

function orderable(column: Column): boolean {
  return ['number', 'integer', 'date', 'date-time'].includes(column.type);
}

function textOf(value: CellValue): string {
  return Array.isArray(value) ? value.join(' ') : String(value);
}

function evaluate(columns: readonly Column[], node: QueryNode, row: Row): boolean {
  switch (node.kind) {
    case 'term': {
      if (node.field !== null) {
        const column = columnNamed(columns, node.field);
        return column ? matchesValue(column, row.values[column.id], node.value) : false;
      }
      return columns.some((column) => {
        const value = row.values[column.id];
        return value !== undefined && normalize(textOf(value)).includes(node.value);
      });
    }
    case 'facet': {
      const column = columnNamed(columns, node.facet);
      return column ? matchesValue(column, row.values[column.id], node.value) : false;
    }
    case 'compare': {
      const column = columnNamed(columns, node.facet);
      const value = column ? row.values[column.id] : undefined;
      if (!column || value === undefined || typeof value !== 'string') return false;
      return compares(column, value, node.op, node.value);
    }
    case 'not':
      return !evaluate(columns, node.node, row);
    case 'and':
      return node.nodes.every((each) => evaluate(columns, each, row));
    case 'or':
      return node.nodes.some((each) => evaluate(columns, each, row));
  }
}

function matchesValue(column: Column, value: CellValue | undefined, wanted: string): boolean {
  if (value === undefined) return false;
  switch (column.type) {
    case 'number':
    case 'integer': {
      const decimal = canonicalDecimal(wanted);
      return decimal !== null && typeof value === 'string' && compareDecimal(value, decimal) === 0;
    }
    case 'boolean':
      return String(value) === wanted;
    case 'date':
    case 'date-time':
      return typeof value === 'string' && normalize(value).startsWith(wanted);
    case 'list':
      return Array.isArray(value) && value.some((item) => normalize(item).includes(wanted));
    case 'string':
      return normalize(String(value)).includes(wanted);
  }
}

/**
 * A date is compared at the granularity it was asked in: `date:<=2026-10`
 * keeps the whole of October, which comparing `2026-10-05` with `2026-10`
 * character by character would not.
 */
function compares(column: Column, value: string, op: Comparison, wanted: string): boolean {
  let order: number;
  if (column.type === 'number' || column.type === 'integer') {
    const decimal = canonicalDecimal(wanted);
    if (decimal === null) return false;
    order = compareDecimal(value, decimal);
  } else {
    const held = normalize(value).slice(0, wanted.length);
    order = held < wanted ? -1 : held > wanted ? 1 : 0;
  }
  switch (op) {
    case '>=':
      return order >= 0;
    case '<=':
      return order <= 0;
    case '>':
      return order > 0;
    case '<':
      return order < 0;
  }
}

/** Checks an order against the columns, by name. */
export function checkOrder(
  columns: readonly Column[],
  sort: readonly RowOrder[],
): Result<void, DomainError> {
  for (const each of sort) {
    if (!columns.some((column) => sameColumnName(column.name, each.column))) {
      return err(DomainError.validation(`The table has no column "${each.column}" to sort by`));
    }
  }
  return ok(undefined);
}

function compareCells(column: Column, a: CellValue, b: CellValue): number {
  if (
    (column.type === 'number' || column.type === 'integer') &&
    typeof a === 'string' &&
    typeof b === 'string'
  ) {
    return compareDecimal(a, b);
  }
  if (column.type === 'boolean') return Number(a) - Number(b);
  const x = column.type === 'string' || column.type === 'list' ? normalize(textOf(a)) : textOf(a);
  const y = column.type === 'string' || column.type === 'list' ? normalize(textOf(b)) : textOf(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Filters, orders and cuts one page. Rows with no value in a sorted column go
 * last, whichever the direction, and rows that tie keep the order they were
 * inserted in.
 */
export function pageOf(
  columns: readonly Column[],
  rows: readonly Row[],
  filter: ((row: Row) => boolean) | null,
  request: RowRequest,
): RowPage {
  const matched = filter ? rows.filter(filter) : [...rows];
  const orders = request.sort
    .map((each) => ({
      column: columns.find((c) => sameColumnName(c.name, each.column)),
      direction: each.direction,
    }))
    .filter(
      (each): each is { column: Column; direction: 'asc' | 'desc' } => each.column !== undefined,
    );
  matched.sort((a, b) => {
    for (const { column, direction } of orders) {
      const x = a.values[column.id];
      const y = b.values[column.id];
      if (x === undefined && y === undefined) continue;
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      const order = compareCells(column, x, y);
      if (order !== 0) return direction === 'asc' ? order : -order;
    }
    return a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0;
  });
  if (request.all) {
    return { rows: matched, total: matched.length, page: 1, pageSize: Math.max(1, matched.length) };
  }
  const size = Math.min(Math.max(1, Math.trunc(request.pageSize)), MAX_PAGE_SIZE);
  const page = Math.max(1, Math.trunc(request.page));
  return {
    rows: matched.slice((page - 1) * size, page * size),
    total: matched.length,
    page,
    pageSize: size,
  };
}
