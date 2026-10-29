/**
 * The schema of a Table (#366, RN-KNW-067): the subset of JSON Schema it reads,
 * the values it keeps, and the decimal text a number is kept as.
 */

import { describe, expect, it } from 'vitest';
import {
  canonicalDecimal,
  cellOf,
  compareDecimal,
  isDate,
  isDateTime,
  readSchema,
  tableSchema,
  type Column,
} from '../src/domain/table/TableSchema.js';
import { compileFilter, pageOf } from '../src/domain/table/RowQuery.js';
import type { Row } from '../src/domain/table/Row.js';
import { authorship, expectErr, unwrap } from './fixtures.js';

const column = (overrides: Partial<Column>): Column => ({
  id: 'c1',
  name: 'value',
  type: 'string',
  description: '',
  required: false,
  default: null,
  enum: null,
  minimum: null,
  maximum: null,
  maxLength: null,
  ...overrides,
});

describe('a number of a table', () => {
  it('is kept as canonical decimal text, never as a float', () => {
    expect(canonicalDecimal(0.1 + 0.2)).toBe('0.30000000000000004');
    expect(canonicalDecimal('0.30')).toBe('0.3');
    expect(canonicalDecimal('-0')).toBe('0');
    expect(canonicalDecimal('1e3')).toBe('1000');
    expect(canonicalDecimal('1.5e-3')).toBe('0.0015');
    expect(canonicalDecimal('007.50')).toBe('7.5');
    expect(canonicalDecimal('12345678901234567890.123456789')).toBe(
      '12345678901234567890.123456789',
    );
    expect(canonicalDecimal('1'.repeat(39))).toBeNull();
    expect(canonicalDecimal('abc')).toBeNull();
  });

  it('compares by value, whatever its length', () => {
    expect(compareDecimal('10', '9')).toBeGreaterThan(0);
    expect(compareDecimal('-10', '-9')).toBeLessThan(0);
    expect(compareDecimal('1.50', '1.5')).toBe(0);
    expect(compareDecimal('0.05', '0.5')).toBeLessThan(0);
  });

  it('reads a file written in either locale, and only there', () => {
    const amount = column({ type: 'number' });
    expect(unwrap(cellOf(amount, '1.250,75', false))).toBe('1250.75');
    expect(unwrap(cellOf(amount, '1,250.75', false))).toBe('1250.75');
    expect(expectErr(cellOf(amount, true, true)).message).toContain('holds a number');
  });
});

describe('a date of a table', () => {
  it('is a real day of the calendar', () => {
    expect(isDate('2026-02-28')).toBe(true);
    expect(isDate('2026-02-29')).toBe(false);
    expect(isDateTime('2026-10-29T14:30')).toBe(true);
    expect(isDateTime('2026-10-29T24:00')).toBe(false);
  });
});

describe('a table schema', () => {
  it('refuses a keyword outside the subset, naming it, and never ignores it', () => {
    const refused = expectErr(
      readSchema({ type: 'object', properties: { code: { type: 'string', pattern: '^A' } } }),
    );
    expect(refused.message).toContain('"pattern"');
    expect(expectErr(readSchema({ properties: { a: { type: 'object' } } })).message).toContain(
      'type "object"',
    );
    expect(
      expectErr(readSchema({ properties: { 'two words': { type: 'string' } } })).message,
    ).toContain('not one word');
  });

  it('reads back as the schema it was declared with', () => {
    const declared = {
      type: 'object',
      properties: {
        date: { type: 'string', format: 'date' },
        amount: { type: 'number', minimum: 0 },
        tags: { type: 'array', items: { type: 'string', enum: ['a', 'b'] } },
        paid: { type: 'boolean', default: false },
      },
      required: ['date'],
      additionalProperties: false,
    };
    const read = unwrap(readSchema(declared));
    const columns = read.columns.map((each, index) => ({ ...each, id: `c${index + 1}` }));
    expect(tableSchema(columns)).toEqual(declared);
  });
});

describe('the rows of a table, filtered', () => {
  const columns: Column[] = [
    column({ id: 'c1', name: 'date', type: 'date' }),
    column({ id: 'c2', name: 'amount', type: 'number' }),
    column({ id: 'c3', name: 'description' }),
  ];
  const by = authorship();
  const rows: Row[] = [
    ['2026-09-30', '2000', 'Rent'],
    ['2026-10-01', '120.5', 'Market'],
    ['2026-10-31', '30', 'Farmácia'],
  ].map(([date, amount, description], index) => ({
    rowId: `r${index}`,
    values: { c1: date as string, c2: amount as string, c3: description as string },
    seq: String(index),
    createdBy: by,
    updatedBy: by,
    version: 1,
  }));
  const names = (where: string) =>
    pageOf(columns, rows, unwrap(compileFilter(columns, where)), {
      where,
      sort: [],
      page: 1,
      pageSize: 25,
    }).rows.map((row) => row.values['c3']);

  it('compares a date at the granularity it was asked in', () => {
    expect(names('date:2026-10')).toEqual(['Market', 'Farmácia']);
    expect(names('date:<=2026-10')).toEqual(['Rent', 'Market', 'Farmácia']);
    expect(names('date:<2026-10')).toEqual(['Rent']);
  });

  it('compares a number by its value, not its text', () => {
    expect(names('amount:>100')).toEqual(['Rent', 'Market']);
    expect(names('amount:30..200')).toEqual(['Market', 'Farmácia']);
  });

  it('matches text with case and accents ignored, and refuses a column it lacks', () => {
    expect(names('FARMACIA')).toEqual(['Farmácia']);
    expect(names('-description:rent')).toEqual(['Market', 'Farmácia']);
    expect(expectErr(compileFilter(columns, 'category:food')).message).toContain('"category"');
    expect(expectErr(compileFilter(columns, 'description:>a')).message).toContain('interval');
  });
});
