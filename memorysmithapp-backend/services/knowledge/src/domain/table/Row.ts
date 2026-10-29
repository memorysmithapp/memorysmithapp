/**
 * A row of a Table (#366): values by column identifier, and nothing that says
 * what they mean. A row keeps no revisions; the trail says who wrote which of
 * its columns and when, never the values (INV-06, INV-08).
 */

import { sha256Hex, ulid, type Authorship } from '@memorysmithapp/kernel';
import type { CellValue, Column } from './TableSchema.js';

export interface Row {
  readonly rowId: string;
  /** Values by column identifier; a column with no value is absent. */
  readonly values: Readonly<Record<string, CellValue>>;
  /** Orders the rows the way they were inserted, which is the default order. */
  readonly seq: string;
  readonly createdBy: Authorship;
  readonly updatedBy: Authorship;
  readonly version: number;
}

/** The bytes a row costs: its values as the store keeps them. */
export function rowBytes(values: Readonly<Record<string, CellValue>>): number {
  return new TextEncoder().encode(JSON.stringify(values)).byteLength;
}

/**
 * The identifier of a row. A table with a key derives it from the values of
 * the key, so the row a key names is found without a read and two writes of
 * one key meet on one item; a table without a key gives each row its own.
 */
export function rowIdOf(
  key: readonly string[] | null,
  values: Readonly<Record<string, CellValue>>,
): string {
  if (!key || key.length === 0) return ulid();
  return `K${sha256Hex(JSON.stringify(key.map((id) => values[id] ?? null))).slice(0, 40)}`;
}

/** Whether a row holds a value for every column of the key. */
export function hasKey(
  key: readonly string[],
  values: Readonly<Record<string, CellValue>>,
): boolean {
  return key.every((id) => values[id] !== undefined);
}

/** The names of the columns a set of values touches, for the trail. */
export function columnNames(columns: readonly Column[], ids: Iterable<string>): string[] {
  const byId = new Map(columns.map((column) => [column.id, column.name]));
  return [...new Set(ids)].map((id) => byId.get(id) ?? id);
}
