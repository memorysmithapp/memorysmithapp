/**
 * The schema of a Table (#366): its columns, read from a subset of JSON Schema
 * 2020-12 and written back to it.
 *
 * JSON Schema because an agent already writes it for every tool it calls, so a
 * table is declared in a language the agent knows by heart; a SUBSET because a
 * table is flat. What is outside the subset is refused naming the keyword, and
 * never ignored: an agent that wrote `pattern` and saw it accepted would believe
 * the rule holds.
 *
 * A column has an identifier of its own, `c1`, `c2`, …, given in the order the
 * columns were added and never reused. A row stores its values by that
 * identifier, so renaming a column rewrites no row.
 *
 * Numbers are kept as their decimal text, never as a float: a value of money
 * read back is the value written, up to 38 significant digits, the most a
 * DynamoDB number holds.
 */

import { DomainError, err, ok, type Result } from '@memorysmithapp/kernel';

export type ColumnType =
  'string' | 'number' | 'integer' | 'boolean' | 'date' | 'date-time' | 'list';

/** A value as a row keeps it: a number as its canonical decimal text. */
export type CellValue = string | boolean | readonly string[];

export interface Column {
  readonly id: string;
  readonly name: string;
  readonly type: ColumnType;
  readonly description: string;
  readonly required: boolean;
  readonly default: CellValue | null;
  /** The values a `string` column, or each item of a `list`, may take. */
  readonly enum: readonly string[] | null;
  /** Bounds of a `number` or an `integer`, as decimal text. */
  readonly minimum: string | null;
  readonly maximum: string | null;
  /** The longest a `string`, or each item of a `list`, may be. */
  readonly maxLength: number | null;
}

/** The limits of a table (#366, PRD §8). */
export const TABLE_LIMITS = {
  rows: 10_000,
  rowBytes: 4 * 1024,
  columns: 50,
  tablesPerNotebook: 50,
  rowsPerCall: 50,
  nameLength: 64,
  descriptionLength: 500,
} as const;

/**
 * A column is addressed by its name in a filter, `amount:>100`, and in a
 * `table` block, so a name is one word: letters (accented ones included),
 * digits, `_` and `-`, as the name of a model parameter is (RN-PRT-034).
 */
const COLUMN_NAME = /^[\p{L}\p{N}_-]+$/u;
const MAX_SIGNIFICANT_DIGITS = 38;

const PROPERTY_KEYWORDS = new Set([
  'type',
  'format',
  'enum',
  'default',
  'description',
  'minimum',
  'maximum',
  'maxLength',
  'items',
]);
const TOP_KEYWORDS = new Set([
  '$schema',
  'type',
  'properties',
  'required',
  'additionalProperties',
  'description',
]);

function invalid(message: string): Result<never, DomainError> {
  return err(DomainError.validation(message));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Two column names are one name when they differ only in case or form. */
export function sameColumnName(a: string, b: string): boolean {
  return a.normalize('NFC').toLowerCase() === b.normalize('NFC').toLowerCase();
}

export function checkColumnName(raw: string): Result<string, DomainError> {
  const name = raw.normalize('NFC').trim();
  if (name.length === 0) return invalid('A column needs a name');
  if (name.length > TABLE_LIMITS.nameLength) {
    return invalid(`A column name goes up to ${TABLE_LIMITS.nameLength} characters`);
  }
  if (!COLUMN_NAME.test(name)) {
    return invalid(
      `The column name "${name}" is not one word: a filter addresses a column as name:value, so a name holds letters, digits, _ and - only`,
    );
  }
  return ok(name);
}

// ---------------------------------------------------------------------------
// Decimal text
// ---------------------------------------------------------------------------

/**
 * A number as canonical decimal text: no exponent, no leading zeros, no
 * trailing zeros after the point, and `-0` as `0`. `null` when it is not a
 * finite number or carries more digits than a row can keep exactly.
 */
export function canonicalDecimal(raw: unknown): string | null {
  let text: string;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    text = String(raw);
  } else if (typeof raw === 'string') {
    text = raw.trim();
  } else {
    return null;
  }
  const match = /^([+-])?(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) return null;
  const negative = match[1] === '-';
  let digits = (match[2] ?? '') + (match[3] ?? '');
  let point = (match[2] ?? '').length + Number(match[4] ?? 0);
  // Move the point into the digits, padding with zeros where the exponent
  // reaches past either end.
  if (point < 0) {
    digits = '0'.repeat(-point) + digits;
    point = 0;
  }
  if (point > digits.length) digits = digits + '0'.repeat(point - digits.length);
  let integer = digits.slice(0, point).replace(/^0+/, '') || '0';
  const fraction = digits.slice(point).replace(/0+$/, '');
  const significant = (integer === '0' ? '' : integer) + fraction;
  if (significant.replace(/^0+/, '').length > MAX_SIGNIFICANT_DIGITS) return null;
  if (integer === '0' && fraction.length === 0) return '0';
  integer = integer || '0';
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
}

/** Compares two canonical decimals: negative, zero or positive. */
export function compareDecimal(a: string, b: string): number {
  const negativeA = a.startsWith('-');
  const negativeB = b.startsWith('-');
  if (negativeA !== negativeB) return negativeA ? -1 : 1;
  const sign = negativeA ? -1 : 1;
  const [ia = '', fa = ''] = (negativeA ? a.slice(1) : a).split('.');
  const [ib = '', fb = ''] = (negativeB ? b.slice(1) : b).split('.');
  if (ia.length !== ib.length) return sign * (ia.length - ib.length);
  if (ia !== ib) return sign * (ia < ib ? -1 : 1);
  const width = Math.max(fa.length, fb.length);
  const pa = fa.padEnd(width, '0');
  const pb = fb.padEnd(width, '0');
  if (pa === pb) return 0;
  return sign * (pa < pb ? -1 : 1);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

function realDate(year: string, month: string, day: string): boolean {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1) return false;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last;
}

export function isDate(value: string): boolean {
  const match = DATE.exec(value);
  return match !== null && realDate(match[1] ?? '', match[2] ?? '', match[3] ?? '');
}

export function isDateTime(value: string): boolean {
  const match = DATE_TIME.exec(value);
  if (!match || !realDate(match[1] ?? '', match[2] ?? '', match[3] ?? '')) return false;
  return Number(match[4]) < 24 && Number(match[5]) < 60 && Number(match[6] ?? 0) < 60;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/**
 * Whether a value fits a column, and the value as a row keeps it. `strict` is
 * what the connector writes, where a number is a number and a boolean a
 * boolean; the lenient form reads what a file or an older type holds, where
 * everything arrived as text: `"12"` is a number, `"sim"` and `"yes"` are true.
 */
export function cellOf(
  column: Column,
  raw: unknown,
  strict: boolean,
): Result<CellValue, DomainError> {
  const named = `The column "${column.name}"`;
  switch (column.type) {
    case 'string': {
      const text =
        typeof raw === 'string'
          ? raw
          : !strict && (typeof raw === 'number' || typeof raw === 'boolean')
            ? String(raw)
            : null;
      if (text === null) return invalid(`${named} holds text`);
      return textFits(column, text, named);
    }
    case 'number':
    case 'integer': {
      if (strict && typeof raw !== 'number' && typeof raw !== 'string') {
        return invalid(`${named} holds a number`);
      }
      const decimal = canonicalDecimal(lenientNumber(raw, strict));
      if (decimal === null) {
        return invalid(
          `${named} holds a number, of at most ${MAX_SIGNIFICANT_DIGITS} significant digits`,
        );
      }
      if (column.type === 'integer' && decimal.includes('.')) {
        return invalid(`${named} holds a whole number`);
      }
      if (column.minimum !== null && compareDecimal(decimal, column.minimum) < 0) {
        return invalid(`${named} holds at least ${column.minimum}`);
      }
      if (column.maximum !== null && compareDecimal(decimal, column.maximum) > 0) {
        return invalid(`${named} holds at most ${column.maximum}`);
      }
      return ok(decimal);
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return ok(raw);
      if (!strict && (typeof raw === 'string' || typeof raw === 'number')) {
        const word = String(raw).trim().toLowerCase();
        if (['true', 'yes', 'sim', 'y', 's', '1', 'verdadeiro', 'x'].includes(word))
          return ok(true);
        if (['false', 'no', 'não', 'nao', 'n', '0', 'falso', ''].includes(word)) return ok(false);
      }
      return invalid(`${named} holds true or false`);
    }
    case 'date': {
      const text = typeof raw === 'string' ? raw.trim() : null;
      const day = text && !strict ? dayFirst(text) : text;
      const value = day && !strict && isDateTime(day) ? day.slice(0, 10) : day;
      if (value === null || !isDate(value)) return invalid(`${named} holds a date, as 2026-10-29`);
      return ok(value);
    }
    case 'date-time': {
      const text = typeof raw === 'string' ? raw.trim() : null;
      const day = text && !strict ? dayFirst(text) : text;
      const value = day && !strict && isDate(day) ? `${day}T00:00` : day;
      if (value === null || !isDateTime(value)) {
        return invalid(`${named} holds a date and a time, as 2026-10-29T14:30`);
      }
      return ok(value);
    }
    case 'list': {
      const items =
        Array.isArray(raw) && raw.every((each) => typeof each === 'string')
          ? (raw as string[])
          : !strict && typeof raw === 'string'
            ? raw
                .split(/[,;]/)
                .map((each) => each.trim())
                .filter((each) => each.length > 0)
            : null;
      if (items === null) return invalid(`${named} holds a list of texts`);
      const kept: string[] = [];
      for (const item of items) {
        const fits = textFits(column, item, `An item of ${named.toLowerCase()}`);
        if (!fits.ok) return fits;
        kept.push(fits.value);
      }
      return ok(kept);
    }
  }
}

/**
 * A date as a file written in pt-BR writes it, day first: `29/10/2026` is
 * 2026-10-29. Only a file is read this way; the connector writes ISO dates.
 */
function dayFirst(text: string): string {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(.*)$/.exec(text);
  if (!match) return text;
  const [, day = '', month = '', year = '', rest = ''] = match;
  const time = /^[ T](\d{2}:\d{2}(?::\d{2})?)$/.exec(rest)?.[1];
  const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return time ? `${date}T${time}` : rest.length === 0 ? date : text;
}

function lenientNumber(raw: unknown, strict: boolean): unknown {
  if (strict || typeof raw !== 'string') return raw;
  // A file written in pt-BR writes 1.250,75; one written in en-US, 1,250.75.
  const text = raw.trim().replace(/\s/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text) || /^-?\d+,\d+$/.test(text)) {
    return text.replace(/\./g, '').replace(',', '.');
  }
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) return text.replace(/,/g, '');
  return text;
}

function textFits(column: Column, text: string, named: string): Result<string, DomainError> {
  if (column.maxLength !== null && [...text].length > column.maxLength) {
    return invalid(`${named} holds at most ${column.maxLength} characters`);
  }
  if (column.enum !== null && !column.enum.includes(text)) {
    return invalid(`${named} holds one of ${column.enum.join(', ')}, and "${text}" is not one`);
  }
  return ok(text);
}

// ---------------------------------------------------------------------------
// Reading JSON Schema
// ---------------------------------------------------------------------------

/** What a column says of itself, before it is given an identifier. */
export type ColumnDeclaration = Omit<Column, 'id'>;

/**
 * One property of a schema, read into a column. `required` is decided by the
 * schema around it, and is given here.
 */
export function readColumn(
  rawName: string,
  property: unknown,
  required: boolean,
): Result<ColumnDeclaration, DomainError> {
  const name = checkColumnName(rawName);
  if (!name.ok) return name;
  const named = `The column "${name.value}"`;
  if (!isRecord(property)) return invalid(`${named} is not declared as an object`);
  for (const keyword of Object.keys(property)) {
    if (!PROPERTY_KEYWORDS.has(keyword)) {
      return invalid(
        `${named} uses "${keyword}", which a table does not take: a column takes type, format, enum, default, description, minimum, maximum, maxLength and items`,
      );
    }
  }

  const type = typeOf(property, named);
  if (!type.ok) return type;

  const description = property['description'];
  if (description !== undefined && typeof description !== 'string') {
    return invalid(`${named} has a description that is not text`);
  }
  if (typeof description === 'string' && description.length > TABLE_LIMITS.descriptionLength) {
    return invalid(`A description goes up to ${TABLE_LIMITS.descriptionLength} characters`);
  }

  const textual = type.value === 'string' || type.value === 'list';
  const numeric = type.value === 'number' || type.value === 'integer';
  const source = type.value === 'list' ? (property['items'] as Record<string, unknown>) : property;

  const values = source['enum'];
  let enumeration: string[] | null = null;
  if (values !== undefined) {
    if (!textual) return invalid(`${named} takes enum only when it holds text`);
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      !values.every((v) => typeof v === 'string')
    ) {
      return invalid(`${named} lists its enum as texts`);
    }
    enumeration = [...new Set(values as string[])];
  }

  const maxLength = source['maxLength'];
  if (maxLength !== undefined) {
    if (!textual) return invalid(`${named} takes maxLength only when it holds text`);
    if (typeof maxLength !== 'number' || !Number.isInteger(maxLength) || maxLength < 1) {
      return invalid(`${named} gives maxLength as a positive whole number`);
    }
  }

  const bound = (keyword: 'minimum' | 'maximum'): Result<string | null, DomainError> => {
    const raw = property[keyword];
    if (raw === undefined) return ok(null);
    if (!numeric) return invalid(`${named} takes ${keyword} only when it holds a number`);
    const decimal = canonicalDecimal(raw);
    if (decimal === null || typeof raw !== 'number')
      return invalid(`${named} gives ${keyword} as a number`);
    return ok(decimal);
  };
  const minimum = bound('minimum');
  if (!minimum.ok) return minimum;
  const maximum = bound('maximum');
  if (!maximum.ok) return maximum;
  if (
    minimum.value !== null &&
    maximum.value !== null &&
    compareDecimal(minimum.value, maximum.value) > 0
  ) {
    return invalid(`${named} has a minimum above its maximum`);
  }

  const declared: ColumnDeclaration = {
    name: name.value,
    type: type.value,
    description: typeof description === 'string' ? description.trim() : '',
    required,
    default: null,
    enum: enumeration,
    minimum: minimum.value,
    maximum: maximum.value,
    maxLength: typeof maxLength === 'number' ? maxLength : null,
  };

  if (property['default'] !== undefined) {
    const value = cellOf({ ...declared, id: '' }, property['default'], true);
    if (!value.ok)
      return invalid(
        `The default of ${named.toLowerCase()} does not fit it: ${value.error.message}`,
      );
    return ok({ ...declared, default: value.value });
  }
  return ok(declared);
}

function typeOf(property: Record<string, unknown>, named: string): Result<ColumnType, DomainError> {
  const type = property['type'];
  const format = property['format'];
  if (
    format !== undefined &&
    (type !== 'string' || (format !== 'date' && format !== 'date-time'))
  ) {
    return invalid(`${named} takes format only as date or date-time, on a string`);
  }
  switch (type) {
    case 'string':
      return ok(format === 'date' ? 'date' : format === 'date-time' ? 'date-time' : 'string');
    case 'number':
    case 'integer':
    case 'boolean':
      if (property['items'] !== undefined) return invalid(`${named} takes items only as an array`);
      return ok(type);
    case 'array': {
      const items = property['items'];
      if (!isRecord(items) || items['type'] !== 'string') {
        return invalid(`${named} is an array of strings, declared as items: { "type": "string" }`);
      }
      for (const keyword of Object.keys(items)) {
        if (!['type', 'enum', 'maxLength'].includes(keyword)) {
          return invalid(`The items of ${named.toLowerCase()} take type, enum and maxLength only`);
        }
      }
      return ok('list');
    }
    default:
      return invalid(
        `${named} has type ${JSON.stringify(type)}: a column is a string, number, integer, boolean or an array of strings`,
      );
  }
}

/** A whole schema, as `create_table` receives it. */
export function readSchema(
  schema: unknown,
): Result<{ columns: ColumnDeclaration[]; description: string | null }, DomainError> {
  if (!isRecord(schema)) return invalid('A table schema is a JSON Schema object');
  for (const keyword of Object.keys(schema)) {
    if (!TOP_KEYWORDS.has(keyword)) {
      return invalid(
        `A table schema does not take "${keyword}": it takes type, properties, required, additionalProperties and description`,
      );
    }
  }
  if (schema['type'] !== undefined && schema['type'] !== 'object') {
    return invalid('A table schema has type "object": each row is an object');
  }
  if (schema['additionalProperties'] !== undefined && schema['additionalProperties'] !== false) {
    return invalid(
      'A row never takes a column its table does not declare: additionalProperties is false or absent',
    );
  }
  const properties = schema['properties'];
  if (!isRecord(properties) || Object.keys(properties).length === 0) {
    return invalid('A table declares at least one column in properties');
  }
  const names = Object.keys(properties);
  if (names.length > TABLE_LIMITS.columns) {
    return invalid(`A table holds up to ${TABLE_LIMITS.columns} columns`);
  }
  const required = schema['required'];
  if (
    required !== undefined &&
    (!Array.isArray(required) || !required.every((r) => typeof r === 'string'))
  ) {
    return invalid('required lists column names');
  }
  const requiredNames = (required as string[] | undefined) ?? [];
  for (const each of requiredNames) {
    if (!names.includes(each)) return invalid(`required names "${each}", which is not a column`);
  }

  const columns: ColumnDeclaration[] = [];
  for (const name of names) {
    const column = readColumn(name, properties[name], requiredNames.includes(name));
    if (!column.ok) return column;
    if (columns.some((each) => sameColumnName(each.name, column.value.name))) {
      return invalid(`Two columns are called "${column.value.name}"`);
    }
    columns.push(column.value);
  }
  const description = schema['description'];
  return ok({ columns, description: typeof description === 'string' ? description : null });
}

// ---------------------------------------------------------------------------
// Writing JSON Schema
// ---------------------------------------------------------------------------

/** One column as a JSON Schema property, the form an agent reads it in. */
export function columnSchema(column: Column): Record<string, unknown> {
  const textual: Record<string, unknown> = {
    ...(column.enum ? { enum: [...column.enum] } : {}),
    ...(column.maxLength !== null ? { maxLength: column.maxLength } : {}),
  };
  const base: Record<string, unknown> =
    column.type === 'date' || column.type === 'date-time'
      ? { type: 'string', format: column.type }
      : column.type === 'list'
        ? { type: 'array', items: { type: 'string', ...textual } }
        : column.type === 'string'
          ? { type: 'string', ...textual }
          : { type: column.type };
  if (column.minimum !== null) base['minimum'] = Number(column.minimum);
  if (column.maximum !== null) base['maximum'] = Number(column.maximum);
  if (column.default !== null) base['default'] = presentCell(column, column.default);
  if (column.description) base['description'] = column.description;
  return base;
}

export function tableSchema(columns: readonly Column[]): Record<string, unknown> {
  return {
    type: 'object',
    properties: Object.fromEntries(columns.map((column) => [column.name, columnSchema(column)])),
    required: columns.filter((column) => column.required).map((column) => column.name),
    additionalProperties: false,
  };
}

/**
 * A value as an answer carries it: a number as a JSON number when that number
 * reads back as the same decimal, and as its text when it would not, so no
 * digit is ever lost on the way out.
 */
export function presentCell(column: Column, value: CellValue): unknown {
  if ((column.type === 'number' || column.type === 'integer') && typeof value === 'string') {
    const number = Number(value);
    return canonicalDecimal(number) === value ? number : value;
  }
  return Array.isArray(value) ? [...value] : value;
}
