/**
 * What each component of a Dashboard draws, computed from its tables (#368).
 *
 * The tables a dashboard draws from are each read once, whatever number of
 * components read them, and every component is answered on its own: a table
 * deleted, or a filter that no longer fits a changed schema, is said in place
 * of that component and leaves the others drawn.
 *
 * A period filter of the dashboard applies to every component whose table has
 * its column: `2026-10` keeps October, by the same prefix a filter compares a
 * date with (RN-KNW-073).
 *
 * A mark clicked on a chart narrows the other components (#369, RN-KNW-086):
 * each one whose table can be grouped the way that chart groups keeps the rows
 * of that group, and the chart itself stays whole, so the mark can be seen
 * among the others and clicked again.
 */

import type { Row } from '../table/Row.js';
import {
  aggregate,
  groupKeysOf,
  readAggregate,
  readGrouping,
  type AggregateGroup,
  type MeasureValue,
} from '../table/RowAggregate.js';
import { compileFilter, pageOf } from '../table/RowQuery.js';
import { type Column, presentCell, sameColumnName } from '../table/TableSchema.js';
import type { DashboardComponent, Definition, TableShape } from './DashboardDefinition.js';

/** How many rows a Gantt or a Kanban draws, at most. */
export const ITEMS_DRAWN = 500;

/** How many columns a matrix draws: more is a grouping by the wrong column. */
export const MATRIX_COLUMNS = 50;

/** A mark clicked on a chart: which component, and the group of that mark. */
export interface CrossFilter {
  readonly component: string;
  readonly key: string;
}

export type ComponentData =
  | { readonly id: string; readonly status: 'missing-table' }
  | { readonly id: string; readonly status: 'refused'; readonly message: string }
  | { readonly id: string; readonly status: 'ok'; readonly kind: 'text' }
  | {
      readonly id: string;
      readonly status: 'ok';
      readonly kind: 'value';
      readonly value: number | string | null;
      readonly compared: number | string | null;
    }
  | {
      readonly id: string;
      readonly status: 'ok';
      readonly kind: 'groups';
      readonly measures: string[];
      readonly groups: AggregateGroup[];
    }
  | {
      readonly id: string;
      readonly status: 'ok';
      readonly kind: 'rows';
      readonly columns: Array<{ name: string; type: Column['type'] }>;
      readonly rows: Array<{ rowId: string; values: Record<string, unknown> }>;
      readonly total: number;
    }
  | {
      readonly id: string;
      readonly status: 'ok';
      readonly kind: 'matrix';
      readonly measure: string;
      readonly columns: Array<string | null>;
      readonly rows: Array<{
        key: string | null;
        cells: MeasureValue[];
        total: MeasureValue;
      }>;
      readonly totals: MeasureValue[];
      readonly grand: MeasureValue;
    };

export interface TableWithRows extends TableShape {
  readonly rows: readonly Row[];
}

function rowValues(columns: readonly Column[], row: Row): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const column of columns) {
    const value = row.values[column.id];
    if (value !== undefined) values[column.name] = presentCell(column, value);
  }
  return values;
}

/** The filter of a component with the periods of the dashboard its table answers. */
function whereOf(
  component: DashboardComponent,
  table: TableShape,
  filters: Definition['filters'],
  chosen: Readonly<Record<string, string | null>>,
): string | null {
  const parts = component.source?.where ? [`(${component.source.where})`] : [];
  for (const filter of filters) {
    const value = filter.id in chosen ? chosen[filter.id] : filter.default;
    if (!value) continue;
    const column = table.columns.find((each) => sameColumnName(each.name, filter.column));
    if (column) parts.push(`${column.name}:${value}`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

/** What a component keeps of a mark clicked on another: a test of a row, or nothing. */
function crossedBy(
  cross: CrossFilter | null,
  definition: Definition,
  component: DashboardComponent,
  table: TableShape,
): ((row: Row) => boolean) | null {
  if (!cross || cross.component === component.id) return null;
  const group = definition.components.find((each) => each.id === cross.component)?.source?.group;
  if (!group) return null;
  const grouping = readGrouping(table.columns, group);
  if (!grouping.ok) return null;
  return (row) => groupKeysOf(row, grouping.value).includes(cross.key);
}

/** A matrix (#369): a group of rows by a group of columns, with what each adds up to. */
function matrixOf(
  component: DashboardComponent,
  table: TableWithRows,
  kept: readonly Row[],
): ComponentData {
  const refused = (message: string): ComponentData => ({
    id: component.id,
    status: 'refused',
    message,
  });
  const source = component.source;
  if (!source) return refused('A matrix draws from a table');
  const across = readGrouping(table.columns, String(component.options['across']));
  if (!across.ok) return refused(across.error.message);
  const byRow = readAggregate(table.columns, { group: source.group, measures: source.measures });
  const whole = readAggregate(table.columns, { measures: source.measures });
  if (!byRow.ok) return refused(byRow.error.message);
  if (!whole.ok) return refused(whole.error.message);

  const buckets = new Map<string | null, Row[]>();
  for (const row of kept) {
    for (const key of groupKeysOf(row, across.value)) {
      const bucket = buckets.get(key);
      if (bucket) bucket.push(row);
      else buckets.set(key, [row]);
    }
  }
  if (buckets.size > MATRIX_COLUMNS) {
    return refused(`A matrix draws up to ${MATRIX_COLUMNS} columns: group them by a period`);
  }
  const columns = [...buckets.keys()].sort((a, b) =>
    a === null ? 1 : b === null ? -1 : a.localeCompare(b, undefined, { numeric: true }),
  );
  const totalsOf = aggregate(kept, byRow.value);
  if (!totalsOf.ok) return refused(totalsOf.error.message);
  const cells = new Map<string | null, Map<string | null, MeasureValue>>();
  const totals: MeasureValue[] = [];
  for (const column of columns) {
    const rows = buckets.get(column) ?? [];
    const groups = aggregate(rows, byRow.value);
    const total = aggregate(rows, whole.value);
    if (!groups.ok) return refused(groups.error.message);
    totals.push(total.ok ? (total.value[0]?.values[0] ?? null) : null);
    for (const group of groups.value) {
      const line = cells.get(group.key) ?? new Map<string | null, MeasureValue>();
      line.set(column, group.values[0] ?? null);
      cells.set(group.key, line);
    }
  }
  const grand = aggregate(kept, whole.value);
  return {
    id: component.id,
    status: 'ok',
    kind: 'matrix',
    measure: source.measures[0] ?? '',
    columns,
    rows: totalsOf.value.map((group) => ({
      key: group.key,
      cells: columns.map((column) => cells.get(group.key)?.get(column) ?? null),
      total: group.values[0] ?? null,
    })),
    totals,
    grand: grand.ok ? (grand.value[0]?.values[0] ?? null) : null,
  };
}

export function componentData(
  definition: Definition,
  tables: ReadonlyMap<string, TableWithRows>,
  chosen: Readonly<Record<string, string | null>>,
  pages: Readonly<Record<string, number>>,
  cross: CrossFilter | null = null,
): ComponentData[] {
  return definition.components.map((component): ComponentData => {
    if (component.type === 'text' || !component.source)
      return { id: component.id, status: 'ok', kind: 'text' };
    const table = tables.get(component.source.table);
    if (!table) return { id: component.id, status: 'missing-table' };
    const filter = compileFilter(
      table.columns,
      whereOf(component, table, definition.filters, chosen),
    );
    if (!filter.ok) return { id: component.id, status: 'refused', message: filter.error.message };
    const filtered = filter.value;
    const crossed = crossedBy(cross, definition, component, table);
    const narrowed =
      filtered && crossed
        ? (row: Row) => filtered(row) && crossed(row)
        : (crossed ?? filtered ?? null);
    const kept = narrowed ? table.rows.filter(narrowed) : [...table.rows];
    const options = component.options;

    if (component.type === 'kpi') {
      const asked = readAggregate(table.columns, { measures: component.source.measures });
      if (!asked.ok) return { id: component.id, status: 'refused', message: asked.error.message };
      const value = aggregate(kept, asked.value);
      let compared: number | string | null = null;
      if (typeof options['compareWhere'] === 'string') {
        const other = compileFilter(table.columns, options['compareWhere']);
        if (other.ok) {
          const base = other.value ? table.rows.filter(other.value) : table.rows;
          const counted = aggregate(base, asked.value);
          compared = counted.ok ? (counted.value[0]?.values[0] ?? null) : null;
        }
      }
      return {
        id: component.id,
        status: 'ok',
        kind: 'value',
        value: value.ok ? (value.value[0]?.values[0] ?? null) : null,
        compared,
      };
    }

    if (component.type === 'matrix') return matrixOf(component, table, kept);

    if (component.source.group) {
      const asked = readAggregate(table.columns, {
        group: component.source.group,
        measures: component.source.measures,
      });
      if (!asked.ok) return { id: component.id, status: 'refused', message: asked.error.message };
      const counted = aggregate(kept, asked.value);
      if (!counted.ok)
        return { id: component.id, status: 'refused', message: counted.error.message };
      return {
        id: component.id,
        status: 'ok',
        kind: 'groups',
        measures: asked.value.measures.map((measure) => measure.label),
        groups: counted.value,
      };
    }

    const shown =
      component.type === 'table' && Array.isArray(options['columns'])
        ? (options['columns'] as string[])
            .map((name) => table.columns.find((column) => sameColumnName(column.name, name)))
            .filter((column): column is Column => column !== undefined)
        : [...table.columns];
    if (component.type === 'table') {
      const sort = Array.isArray(options['sort'])
        ? (options['sort'] as Array<{ column: string; direction: 'asc' | 'desc' }>)
        : [];
      const pageSize =
        typeof options['pageSize'] === 'number' ? Math.min(100, options['pageSize']) : 10;
      const page = pageOf(table.columns, table.rows, narrowed, {
        where: null,
        sort,
        page: pages[component.id] ?? 1,
        pageSize,
      });
      return {
        id: component.id,
        status: 'ok',
        kind: 'rows',
        columns: shown.map((column) => ({ name: column.name, type: column.type })),
        rows: page.rows.map((row) => ({ rowId: row.rowId, values: rowValues(shown, row) })),
        total: page.total,
      };
    }

    // A Gantt, a Kanban and a WBS draw rows, up to what a screen can hold.
    return {
      id: component.id,
      status: 'ok',
      kind: 'rows',
      columns: shown.map((column) => ({ name: column.name, type: column.type })),
      rows: kept
        .slice(0, ITEMS_DRAWN)
        .map((row) => ({ rowId: row.rowId, values: rowValues(shown, row) })),
      total: kept.length,
    };
  });
}
