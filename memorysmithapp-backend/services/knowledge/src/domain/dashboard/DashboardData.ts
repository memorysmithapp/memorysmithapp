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
 */

import type { Row } from '../table/Row.js';
import { aggregate, readAggregate, type AggregateGroup } from '../table/RowAggregate.js';
import { compileFilter, pageOf } from '../table/RowQuery.js';
import { type Column, presentCell, sameColumnName } from '../table/TableSchema.js';
import type { DashboardComponent, Definition, TableShape } from './DashboardDefinition.js';

/** How many rows a Gantt or a Kanban draws, at most. */
export const ITEMS_DRAWN = 500;

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

export function componentData(
  definition: Definition,
  tables: ReadonlyMap<string, TableWithRows>,
  chosen: Readonly<Record<string, string | null>>,
  pages: Readonly<Record<string, number>>,
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
    const kept = filter.value ? table.rows.filter(filter.value) : [...table.rows];
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
      const page = pageOf(table.columns, table.rows, filter.value, {
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

    // A Gantt and a Kanban draw rows, up to what a screen can hold.
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
