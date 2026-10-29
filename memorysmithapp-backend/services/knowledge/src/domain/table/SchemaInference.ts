/**
 * The schema a sheet suggests (#366): column names out of its header, and a
 * type out of the values each column holds.
 *
 * It is a proposal and nothing more. The agent shows it to the person, who
 * confirms it or changes it, and only then is a table created: a type guessed
 * from a sample is a guess, and a table whose schema nobody read is a table
 * that refuses the next file for a reason nobody can explain.
 */

import type { SheetCell } from '../ports/index.js';
import { cellOf, checkColumnName, type Column } from './TableSchema.js';

export interface InferredColumn {
  /** The header as the file wrote it. */
  readonly header: string;
  /** The column name it becomes: one word, unique. */
  readonly name: string;
  readonly schema: Record<string, unknown>;
  readonly required: boolean;
}

/** How many distinct texts, at most, make a column an enumeration. */
const ENUM_AT_MOST = 8;

/** A header as a column name: one word, accents kept, everything else an underscore. */
export function columnNameOf(header: string, index: number, taken: Set<string>): string {
  const base =
    header
      .normalize('NFC')
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || `column_${index + 1}`;
  let name = base;
  for (let suffix = 2; taken.has(name.toLowerCase()) || !checkColumnName(name).ok; suffix++) {
    name = `${base.slice(0, 60)}_${suffix}`;
  }
  taken.add(name.toLowerCase());
  return name;
}

function fits(type: Column['type'], value: SheetCell): boolean {
  const probe: Column = {
    id: 'c',
    name: 'c',
    type,
    description: '',
    required: false,
    default: null,
    enum: null,
    minimum: null,
    maximum: null,
    maxLength: null,
  };
  return cellOf(probe, value, false).ok;
}

function typeOf(values: readonly SheetCell[]): Column['type'] {
  const present = values.filter((value) => value !== null && value !== '');
  if (present.length === 0) return 'string';
  if (present.every((value) => typeof value === 'boolean')) return 'boolean';
  if (
    present.every(
      (value) => typeof value === 'string' && fits('date', value) && !/[T ]\d{2}:/.test(value),
    )
  ) {
    return 'date';
  }
  if (present.every((value) => typeof value === 'string' && fits('date-time', value)))
    return 'date-time';
  if (present.every((value) => fits('integer', value))) return 'integer';
  if (present.every((value) => fits('number', value))) return 'number';
  return 'string';
}

export function inferColumns(
  header: readonly string[],
  rows: ReadonlyArray<readonly SheetCell[]>,
): InferredColumn[] {
  const taken = new Set<string>();
  return header.map((raw, index) => {
    const values = rows.map((row) => row[index] ?? null);
    const type = typeOf(values);
    const present = values.filter((value) => value !== null && value !== '');
    const schema: Record<string, unknown> =
      type === 'date' || type === 'date-time' ? { type: 'string', format: type } : { type };
    if (type === 'string') {
      const distinct = new Set(present.map((value) => String(value).trim()));
      if (
        distinct.size > 0 &&
        distinct.size <= ENUM_AT_MOST &&
        present.length >= distinct.size * 3
      ) {
        schema['enum'] = [...distinct].sort((a, b) => a.localeCompare(b));
      }
    }
    return {
      header: raw,
      name: columnNameOf(raw, index, taken),
      schema,
      required: present.length === values.length && values.length > 0,
    };
  });
}

/** The proposal as the JSON Schema create_table takes. */
export function proposedSchema(columns: readonly InferredColumn[]): Record<string, unknown> {
  return {
    type: 'object',
    properties: Object.fromEntries(columns.map((column) => [column.name, column.schema])),
    required: columns.filter((column) => column.required).map((column) => column.name),
  };
}
