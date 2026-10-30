import type { TFunction } from 'i18next';
import type { NotebookTableDto } from '@memorysmithapp/contracts';

/**
 * A column of a Table as the page draws it (#366), read off the JSON Schema
 * the API answers: its type in the words of the product, and what the schema
 * says of it.
 */
export interface ColumnView {
  readonly name: string;
  readonly type: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'date-time' | 'list';
  readonly numeric: boolean;
  readonly required: boolean;
  readonly description: string;
  readonly allowed: string[] | null;
  readonly default: unknown;
}

type Property = {
  type?: string;
  format?: string;
  enum?: string[];
  items?: { enum?: string[] };
  description?: string;
  default?: unknown;
};

export function columnsOf(table: NotebookTableDto): ColumnView[] {
  const properties = (table.schema['properties'] ?? {}) as Record<string, Property>;
  const required = new Set((table.schema['required'] as string[] | undefined) ?? []);
  return Object.entries(properties).map(([name, property]) => {
    const type: ColumnView['type'] =
      property.type === 'array'
        ? 'list'
        : property.format === 'date'
          ? 'date'
          : property.format === 'date-time'
            ? 'date-time'
            : property.type === 'number' ||
                property.type === 'integer' ||
                property.type === 'boolean'
              ? property.type
              : 'string';
    return {
      name,
      type,
      numeric: type === 'number' || type === 'integer',
      required: required.has(name),
      description: property.description ?? '',
      allowed: property.enum ?? property.items?.enum ?? null,
      default: property.default,
    };
  });
}

/**
 * A value in the reader's language: `1.250,75` and `29/10/2026` in pt-BR,
 * `1,250.75` and `10/29/2026` in en-US. A number too long for a float arrives
 * as text and is shown as the API wrote it, so no digit is lost on screen.
 */
export function formatCell(
  column: ColumnView,
  value: unknown,
  locale: string,
  t: TFunction,
): string {
  if (value === undefined || value === null || value === '') return '';
  switch (column.type) {
    case 'number':
    case 'integer':
      return typeof value === 'number'
        ? new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(value)
        : String(value);
    case 'boolean':
      return value === true ? t('tables.true') : t('tables.false');
    case 'date': {
      const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
      if (!day) return String(value);
      const date = new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
      return new Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).format(date);
    }
    case 'date-time': {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime())
        ? String(value)
        : new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
    }
    case 'list':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'string':
      return String(value);
  }
}
