/**
 * Adding up the rows of a Table (#368): sum, count, average, minimum and
 * maximum, over the whole filter or by group, a group being the value of a
 * column or a period of a date column — `status`, `date:month`.
 *
 * It is what a dashboard draws from, and an agent reads it through
 * `query_table` too. It runs over the rows a filter kept, on the server, so a
 * chart of ten thousand rows travels as a dozen numbers. A sum is exact: it
 * adds the decimal text the rows keep, never floats.
 */

import { DomainError, err, ok, type Result } from '@memorysmithapp/kernel';
import type { Row } from './Row.js';
import {
  canonicalDecimal,
  type CellValue,
  type Column,
  compareDecimal,
  sameColumnName,
} from './TableSchema.js';

export const PERIODS = ['day', 'week', 'month', 'quarter', 'year'] as const;
export type Period = (typeof PERIODS)[number];

export const MEASURES = ['count', 'sum', 'avg', 'min', 'max'] as const;
export type MeasureKind = (typeof MEASURES)[number];

export interface Measure {
  readonly kind: MeasureKind;
  /** The column measured; `null` for a count of rows. */
  readonly column: Column | null;
  /** As it was asked, `sum(amount)`, which is how an answer names it. */
  readonly label: string;
}

export interface Grouping {
  readonly column: Column;
  readonly period: Period | null;
}

export interface AggregateRequest {
  readonly group: Grouping | null;
  readonly measures: readonly Measure[];
}

/** A value of a measure: a number, the decimal text of a number too long for one, or nothing. */
export type MeasureValue = number | string | null;

export interface AggregateGroup {
  /** The value of the group, `null` for the rows with none and for no grouping. */
  readonly key: string | null;
  readonly values: MeasureValue[];
}

export const MAX_MEASURES = 6;
/** More groups than a chart can show is a grouping by the wrong column. */
export const MAX_GROUPS = 500;

const MEASURE = /^(count|sum|avg|min|max)\(\s*([^()]*)\s*\)$/;

function columnNamed(columns: readonly Column[], name: string): Column | undefined {
  return columns.find((column) => sameColumnName(column.name, name));
}

function invalid(message: string): Result<never, DomainError> {
  return err(DomainError.validation(message));
}

/** `amount`, `count()`, `sum(amount)`, read against the columns. */
export function readMeasure(columns: readonly Column[], raw: string): Result<Measure, DomainError> {
  const match = MEASURE.exec(raw.trim());
  if (!match) {
    return invalid(
      `"${raw}" is not a measure: write count(), sum(column), avg(column), min(column) or max(column)`,
    );
  }
  const kind = match[1] as MeasureKind;
  const name = (match[2] ?? '').trim();
  if (kind === 'count') {
    if (name.length === 0) return ok({ kind, column: null, label: 'count()' });
    const column = columnNamed(columns, name);
    if (!column) return invalid(`The table has no column "${name}" to count`);
    return ok({ kind, column, label: `count(${column.name})` });
  }
  const column = columnNamed(columns, name);
  if (!column) return invalid(`The table has no column "${name}" for ${kind}()`);
  const numeric = column.type === 'number' || column.type === 'integer';
  const orderable = numeric || column.type === 'date' || column.type === 'date-time';
  if ((kind === 'sum' || kind === 'avg') && !numeric) {
    return invalid(`${kind}() adds numbers, and "${column.name}" holds ${column.type}`);
  }
  if (!orderable) {
    return invalid(
      `${kind}() compares numbers or dates, and "${column.name}" holds ${column.type}`,
    );
  }
  return ok({ kind, column, label: `${kind}(${column.name})` });
}

/** `status` or `date:month`, read against the columns. */
export function readGrouping(
  columns: readonly Column[],
  raw: string,
): Result<Grouping, DomainError> {
  const [name = '', period] = raw.split(':').map((part) => part.trim());
  const column = columnNamed(columns, name);
  if (!column) return invalid(`The table has no column "${name}" to group by`);
  if (period === undefined) return ok({ column, period: null });
  if (!(PERIODS as readonly string[]).includes(period)) {
    return invalid(`A date is grouped by ${PERIODS.join(', ')}, and "${period}" is none of them`);
  }
  if (column.type !== 'date' && column.type !== 'date-time') {
    return invalid(`"${column.name}" is not a date, so it is not grouped by a period`);
  }
  return ok({ column, period: period as Period });
}

export function readAggregate(
  columns: readonly Column[],
  input: { group?: string | null | undefined; measures: readonly string[] },
): Result<AggregateRequest, DomainError> {
  if (input.measures.length === 0) return invalid('An aggregate asks for at least one measure');
  if (input.measures.length > MAX_MEASURES) {
    return invalid(`An aggregate asks for up to ${MAX_MEASURES} measures`);
  }
  const measures: Measure[] = [];
  for (const raw of input.measures) {
    const measure = readMeasure(columns, raw);
    if (!measure.ok) return measure;
    measures.push(measure.value);
  }
  if (!input.group) return ok({ group: null, measures });
  const group = readGrouping(columns, input.group);
  if (!group.ok) return group;
  return ok({ group: group.value, measures });
}

/** The day of a date or a date-time, `YYYY-MM-DD`. */
function dayOf(value: string): string {
  return value.slice(0, 10);
}

/** The period a day falls in, written so that periods sort in time. */
export function periodOf(day: string, period: Period): string {
  switch (period) {
    case 'day':
      return day;
    case 'month':
      return day.slice(0, 7);
    case 'year':
      return day.slice(0, 4);
    case 'quarter':
      return `${day.slice(0, 4)}-Q${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1}`;
    case 'week': {
      // The Monday the week starts on, which sorts and reads as a day.
      const date = new Date(`${day}T00:00:00Z`);
      const back = (date.getUTCDay() + 6) % 7;
      date.setUTCDate(date.getUTCDate() - back);
      return date.toISOString().slice(0, 10);
    }
  }
}

function keysOf(grouping: Grouping, value: CellValue | undefined): Array<string | null> {
  if (value === undefined) return [null];
  if (Array.isArray(value)) return value.length === 0 ? [null] : [...value];
  if (typeof value === 'boolean') return [String(value)];
  if (grouping.period && typeof value === 'string')
    return [periodOf(dayOf(value), grouping.period)];
  return [value as string];
}

/** Exact addition of decimal text. */
function addDecimal(a: string, b: string): string {
  const scale = Math.max((a.split('.')[1] ?? '').length, (b.split('.')[1] ?? '').length);
  const toInt = (value: string): bigint => {
    const negative = value.startsWith('-');
    const [whole = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.');
    const digits = BigInt(whole + fraction.padEnd(scale, '0'));
    return negative ? -digits : digits;
  };
  const sum = toInt(a) + toInt(b);
  const negative = sum < 0n;
  const text = (negative ? -sum : sum).toString().padStart(scale + 1, '0');
  const whole = text.slice(0, text.length - scale);
  const fraction = scale > 0 ? text.slice(text.length - scale) : '';
  return canonicalDecimal(`${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`) ?? '0';
}

/** A number as an answer carries it: a JSON number when no digit is lost, its text otherwise. */
function present(decimal: string): MeasureValue {
  const number = Number(decimal);
  return canonicalDecimal(number) === decimal ? number : decimal;
}

interface Accumulator {
  count: number;
  sum: string;
  min: string | null;
  max: string | null;
}

function compareCell(column: Column, a: string, b: string): number {
  if (column.type === 'number' || column.type === 'integer') return compareDecimal(a, b);
  return a < b ? -1 : a > b ? 1 : 0;
}

function finish(measure: Measure, held: Accumulator, rows: number): MeasureValue {
  switch (measure.kind) {
    case 'count':
      return measure.column ? held.count : rows;
    case 'sum':
      return present(held.sum);
    case 'avg':
      return held.count === 0 ? null : Number(held.sum) / held.count;
    case 'min':
      return held.min === null
        ? null
        : measure.column && measure.column.type.startsWith('date')
          ? held.min
          : present(held.min);
    case 'max':
      return held.max === null
        ? null
        : measure.column && measure.column.type.startsWith('date')
          ? held.max
          : present(held.max);
  }
}

/**
 * The groups of the rows, ordered by their key — a period in time, a text in
 * the order of the reader's alphabet — with the rows that have no value last.
 */
export function aggregate(
  rows: readonly Row[],
  request: AggregateRequest,
): Result<AggregateGroup[], DomainError> {
  const groups = new Map<string | null, { rows: number; held: Accumulator[] }>();
  const fresh = () =>
    request.measures.map(() => ({ count: 0, sum: '0', min: null, max: null }) as Accumulator);
  for (const row of rows) {
    const keys = request.group
      ? keysOf(request.group, row.values[request.group.column.id])
      : [null];
    for (const key of keys) {
      let group = groups.get(key);
      if (!group) {
        if (groups.size >= MAX_GROUPS) {
          return invalid(
            `The grouping makes more than ${MAX_GROUPS} groups: group by a period, or by another column`,
          );
        }
        group = { rows: 0, held: fresh() };
        groups.set(key, group);
      }
      group.rows += 1;
      request.measures.forEach((measure, index) => {
        if (!measure.column) return;
        const value = row.values[measure.column.id];
        if (value === undefined) return;
        const held = group.held[index] as Accumulator;
        held.count += 1;
        if (typeof value !== 'string') return;
        if (measure.kind === 'sum' || measure.kind === 'avg')
          held.sum = addDecimal(held.sum, value);
        if (held.min === null || compareCell(measure.column, value, held.min) < 0) held.min = value;
        if (held.max === null || compareCell(measure.column, value, held.max) > 0) held.max = value;
      });
    }
  }
  if (!request.group && groups.size === 0) groups.set(null, { rows: 0, held: fresh() });
  return ok(
    [...groups.entries()]
      .sort(([a], [b]) =>
        a === null ? 1 : b === null ? -1 : a.localeCompare(b, undefined, { numeric: true }),
      )
      .map(([key, group]) => ({
        key,
        values: request.measures.map((measure, index) =>
          finish(measure, group.held[index] as Accumulator, group.rows),
        ),
      })),
  );
}
