/**
 * What a Dashboard says it shows (#368): a layout, filters that apply to the
 * whole of it, and components, each drawing from a Table of the notebook.
 *
 * A definition is data an agent writes, and it is checked whole before it is
 * kept: every component names a table the notebook has, and every column,
 * measure and grouping it uses is one that table can answer. A component
 * names its table by name as the agent writes it and is kept naming it by
 * identifier, so renaming a table breaks no dashboard; it is answered naming
 * it by name again.
 */

import { DomainError, err, ok, type Result } from '@memorysmithapp/kernel';
import { readAggregate, readGrouping } from '../table/RowAggregate.js';
import { compileFilter } from '../table/RowQuery.js';
import { type Column, sameColumnName } from '../table/TableSchema.js';

export const DASHBOARD_LIMITS = {
  components: 24,
  tables: 10,
  dashboardsPerNotebook: 50,
  definitionBytes: 64 * 1024,
  shortestRefreshSeconds: 60,
  nameLength: 120,
  descriptionLength: 500,
  textLength: 4000,
} as const;

export const LAYOUTS = [
  'one-column',
  'two-columns',
  'three-columns',
  'header-two-columns',
  'sidebar',
  'grid',
] as const;
export type Layout = (typeof LAYOUTS)[number];

/** Where a component sits in each named layout. */
export const SLOTS: Readonly<Record<Exclude<Layout, 'grid'>, readonly string[]>> = {
  'one-column': ['main'],
  'two-columns': ['left', 'right'],
  'three-columns': ['left', 'middle', 'right'],
  'header-two-columns': ['header', 'left', 'right', 'footer'],
  sidebar: ['side', 'main'],
};

/** The components of the batches delivered (#368, #369); the others come with theirs. */
export const COMPONENT_TYPES = [
  'kpi',
  'pie',
  'donut',
  'bar',
  'line',
  'area',
  'table',
  'gantt',
  'kanban',
  'text',
  'wbs',
  'matrix',
  'combo',
  'waterfall',
  'funnel',
] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

const CHARTS: ReadonlySet<string> = new Set([
  'pie',
  'donut',
  'bar',
  'line',
  'area',
  'combo',
  'waterfall',
  'funnel',
]);

/** The charts that draw one measure by group. */
const ONE_MEASURE: ReadonlySet<string> = new Set(['pie', 'donut', 'waterfall', 'funnel']);

/** What a table looks like to the check: its identifier, name and columns. */
export interface TableShape {
  readonly tableId: string;
  readonly name: string;
  readonly columns: readonly Column[];
}

export interface DashboardFilter {
  readonly id: string;
  readonly label: string;
  readonly type: 'period';
  /** The date column filtered, by name, in every table that has it. */
  readonly column: string;
  /** The period it opens on: `2026`, `2026-10`, `2026-10-29`, or nothing for all. */
  readonly default: string | null;
}

export interface ComponentSource {
  /** The table, by identifier once kept. */
  readonly table: string;
  readonly where: string | null;
  readonly group: string | null;
  readonly measures: readonly string[];
}

export interface DashboardComponent {
  readonly id: string;
  readonly type: ComponentType;
  readonly title: string;
  readonly slot: string | null;
  readonly grid: { x: number; y: number; w: number; h: number } | null;
  readonly source: ComponentSource | null;
  /** What the type draws with: columns, colours, formats, rules; checked per type. */
  readonly options: Readonly<Record<string, unknown>>;
}

export interface Definition {
  readonly layout: Layout;
  readonly refreshSeconds: number | null;
  readonly filters: readonly DashboardFilter[];
  readonly components: readonly DashboardComponent[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message: string): Result<never, DomainError> {
  return err(DomainError.validation(message));
}

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length <= max ? value : null;
}

const PERIOD_VALUE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const IDENTIFIER = /^[\p{L}\p{N}_-]{1,64}$/u;

/** The options each type reads, by name, and the columns among them. */
const OPTION_COLUMNS: Readonly<Record<ComponentType, readonly string[]>> = {
  kpi: [],
  pie: [],
  donut: [],
  bar: [],
  line: [],
  area: [],
  table: [],
  gantt: ['title', 'start', 'end', 'progress', 'group'],
  kanban: ['lane', 'card', 'detail', 'color'],
  text: [],
  wbs: ['code', 'title', 'progress', 'weight'],
  matrix: [],
  combo: [],
  waterfall: [],
  funnel: [],
};

const OPTION_NAMES: Readonly<Record<ComponentType, readonly string[]>> = {
  kpi: ['format', 'currency', 'decimals', 'compareWhere', 'goal'],
  pie: ['format', 'currency', 'decimals', 'legend', 'labels'],
  donut: ['format', 'currency', 'decimals', 'legend', 'labels'],
  bar: ['format', 'currency', 'decimals', 'legend', 'labels', 'stacked', 'percent', 'horizontal'],
  line: ['format', 'currency', 'decimals', 'legend', 'labels', 'smooth'],
  area: ['format', 'currency', 'decimals', 'legend', 'labels', 'smooth', 'stacked'],
  table: ['columns', 'sort', 'pageSize', 'rules'],
  gantt: ['title', 'start', 'end', 'progress', 'group'],
  kanban: ['lane', 'card', 'detail', 'color', 'lanes'],
  text: ['markdown'],
  wbs: ['code', 'title', 'progress', 'weight'],
  matrix: ['format', 'currency', 'decimals', 'across', 'totals'],
  combo: ['format', 'currency', 'decimals', 'legend', 'labels', 'lines', 'smooth'],
  waterfall: ['format', 'currency', 'decimals', 'labels', 'total'],
  funnel: ['format', 'currency', 'decimals', 'legend', 'labels'],
};

const FORMATS = ['number', 'currency', 'percent'];

/**
 * Reads a definition as an agent wrote it, against the tables of the notebook,
 * and answers it as it is kept: each table by identifier.
 */
export function readDefinition(
  raw: unknown,
  tables: readonly TableShape[],
): Result<Definition, DomainError> {
  if (!isRecord(raw)) return invalid('A dashboard is defined as an object');
  const bytes = new TextEncoder().encode(JSON.stringify(raw)).byteLength;
  if (bytes > DASHBOARD_LIMITS.definitionBytes) {
    return invalid(
      `A dashboard definition goes up to ${DASHBOARD_LIMITS.definitionBytes / 1024} KB`,
    );
  }
  for (const key of Object.keys(raw)) {
    if (!['layout', 'refreshSeconds', 'filters', 'components'].includes(key)) {
      return invalid(
        `A dashboard takes layout, refreshSeconds, filters and components, and not "${key}"`,
      );
    }
  }
  const layout = raw['layout'] ?? 'one-column';
  if (!(LAYOUTS as readonly unknown[]).includes(layout)) {
    return invalid(`The layout is one of ${LAYOUTS.join(', ')}`);
  }

  let refreshSeconds: number | null = null;
  if (raw['refreshSeconds'] !== undefined && raw['refreshSeconds'] !== null) {
    const seconds = raw['refreshSeconds'];
    if (
      typeof seconds !== 'number' ||
      !Number.isInteger(seconds) ||
      seconds < DASHBOARD_LIMITS.shortestRefreshSeconds
    ) {
      return invalid(
        `A dashboard refreshes on its own every ${DASHBOARD_LIMITS.shortestRefreshSeconds} seconds at the shortest`,
      );
    }
    refreshSeconds = seconds;
  }

  const filters: DashboardFilter[] = [];
  for (const [index, each] of ((raw['filters'] as unknown[] | undefined) ?? []).entries()) {
    if (!isRecord(each)) return invalid(`Filter ${index + 1} is an object`);
    const id = text(each['id'], 64);
    if (!id || !IDENTIFIER.test(id)) return invalid(`Filter ${index + 1} needs an id of one word`);
    if (each['type'] !== 'period')
      return invalid(`Filter "${id}" is of type "period", the one a dashboard takes`);
    const column = text(each['column'], 64);
    if (!column) return invalid(`Filter "${id}" names the date column it filters`);
    const fallback = each['default'];
    if (
      fallback !== undefined &&
      fallback !== null &&
      (typeof fallback !== 'string' || !PERIOD_VALUE.test(fallback))
    ) {
      return invalid(`Filter "${id}" opens on a period written 2026, 2026-10 or 2026-10-29`);
    }
    filters.push({
      id,
      label: text(each['label'], 120) ?? id,
      type: 'period',
      column,
      default: (fallback as string | null | undefined) ?? null,
    });
  }

  const rawComponents = raw['components'];
  if (!Array.isArray(rawComponents) || rawComponents.length === 0) {
    return invalid('A dashboard has at least one component');
  }
  if (rawComponents.length > DASHBOARD_LIMITS.components) {
    return invalid(`A dashboard holds up to ${DASHBOARD_LIMITS.components} components`);
  }

  const components: DashboardComponent[] = [];
  const used = new Set<string>();
  for (const [index, each] of rawComponents.entries()) {
    const read = readComponent(each, index, layout as Layout, tables);
    if (!read.ok) return read;
    if (components.some((component) => component.id === read.value.id)) {
      return invalid(`Two components are called "${read.value.id}"`);
    }
    if (read.value.source) used.add(read.value.source.table);
    components.push(read.value);
  }
  if (used.size > DASHBOARD_LIMITS.tables) {
    return invalid(`A dashboard draws from up to ${DASHBOARD_LIMITS.tables} tables`);
  }
  for (const filter of filters) {
    const filtered = tables.filter(
      (table) =>
        used.has(table.tableId) &&
        table.columns.some((column) => sameColumnName(column.name, filter.column)),
    );
    if (filtered.length === 0) {
      return invalid(
        `Filter "${filter.id}" names "${filter.column}", which no table of the dashboard has`,
      );
    }
    for (const table of filtered) {
      const column = table.columns.find((each) => sameColumnName(each.name, filter.column));
      if (column && column.type !== 'date' && column.type !== 'date-time') {
        return invalid(
          `Filter "${filter.id}" is a period, and "${column.name}" of "${table.name}" is not a date`,
        );
      }
    }
  }
  return ok({ layout: layout as Layout, refreshSeconds, filters, components });
}

function readComponent(
  raw: unknown,
  index: number,
  layout: Layout,
  tables: readonly TableShape[],
): Result<DashboardComponent, DomainError> {
  const where = `Component ${index + 1}`;
  if (!isRecord(raw)) return invalid(`${where} is an object`);
  const id = text(raw['id'], 64) ?? `c${index + 1}`;
  if (!IDENTIFIER.test(id)) return invalid(`${where} has an id of one word`);
  const named = `Component "${id}"`;
  const type = raw['type'];
  if (!(COMPONENT_TYPES as readonly unknown[]).includes(type)) {
    return invalid(`${named} is of a type the dashboard draws: ${COMPONENT_TYPES.join(', ')}`);
  }
  const kind = type as ComponentType;
  const title = raw['title'] === undefined ? '' : text(raw['title'], 120);
  if (title === null) return invalid(`${named} has a title of up to 120 characters`);

  let slot: string | null = null;
  let grid: DashboardComponent['grid'] = null;
  if (layout === 'grid') {
    const cell = raw['grid'];
    if (!isRecord(cell))
      return invalid(`${named} sits on the grid as { x, y, w, h }, w from 1 to 12`);
    const [x, y, w, h] = [cell['x'], cell['y'], cell['w'], cell['h']].map((value) => Number(value));
    if (
      ![x, y, w, h].every((value) => Number.isInteger(value)) ||
      (x as number) < 0 ||
      (y as number) < 0 ||
      (w as number) < 1 ||
      (h as number) < 1 ||
      (x as number) + (w as number) > 12
    ) {
      return invalid(
        `${named} sits on the 12 columns of the grid: x from 0, w from 1, x + w at most 12`,
      );
    }
    grid = { x: x as number, y: y as number, w: w as number, h: h as number };
  } else {
    const slots = SLOTS[layout];
    slot = typeof raw['slot'] === 'string' ? raw['slot'] : (slots[0] ?? null);
    if (!slot || !slots.includes(slot)) {
      return invalid(`${named} sits in one of the places of ${layout}: ${slots.join(', ')}`);
    }
  }

  const options = raw['options'] === undefined ? {} : raw['options'];
  if (!isRecord(options)) return invalid(`${named} takes its options as an object`);
  for (const key of Object.keys(options)) {
    if (!OPTION_NAMES[kind].includes(key)) {
      return invalid(
        `${named} is a ${kind}, which takes ${OPTION_NAMES[kind].join(', ') || 'no options'}, and not "${key}"`,
      );
    }
  }
  if (options['format'] !== undefined && !FORMATS.includes(String(options['format']))) {
    return invalid(`${named} formats its values as ${FORMATS.join(', ')}`);
  }

  if (kind === 'text') {
    const markdown = text(options['markdown'], DASHBOARD_LIMITS.textLength);
    if (markdown === null)
      return invalid(
        `${named} is a text, written in options.markdown, of up to ${DASHBOARD_LIMITS.textLength} characters`,
      );
    if (raw['source'] !== undefined)
      return invalid(`${named} is a text, which draws from no table`);
    return ok({ id, type: kind, title, slot, grid, source: null, options });
  }

  const source = raw['source'];
  if (!isRecord(source)) return invalid(`${named} draws from a table, named in source.table`);
  const tableName = text(source['table'], 128);
  const table = tables.find(
    (each) =>
      each.tableId === tableName ||
      (tableName !== null &&
        each.name.toLowerCase() === tableName.normalize('NFC').trim().toLowerCase()),
  );
  if (!table)
    return invalid(
      `${named} draws from "${String(source['table'])}", which this notebook has no table called`,
    );
  const filter =
    source['where'] === undefined || source['where'] === null ? null : text(source['where'], 500);
  if (source['where'] !== undefined && source['where'] !== null && filter === null) {
    return invalid(`${named} filters with a text of up to 500 characters`);
  }
  const compiled = compileFilter(table.columns, filter);
  if (!compiled.ok) return invalid(`${named}: ${compiled.error.message}`);

  const group =
    source['group'] === undefined || source['group'] === null ? null : String(source['group']);
  const measures = Array.isArray(source['measures'])
    ? source['measures'].map(String)
    : source['measure'] !== undefined
      ? [String(source['measure'])]
      : [];

  if (kind === 'kpi') {
    if (measures.length !== 1 || group)
      return invalid(`${named} is a KPI: one measure, as measure: "sum(amount)", and no group`);
    const checked = readAggregate(table.columns, { measures });
    if (!checked.ok) return invalid(`${named}: ${checked.error.message}`);
    if (options['compareWhere'] !== undefined) {
      const compare = compileFilter(table.columns, String(options['compareWhere']));
      if (!compare.ok)
        return invalid(`${named} compares with a filter that fails: ${compare.error.message}`);
    }
  } else if (CHARTS.has(kind)) {
    if (!group)
      return invalid(
        `${named} is a ${kind}: it groups its rows, by a column or a period, in source.group`,
      );
    if (measures.length === 0)
      return invalid(`${named} is a ${kind}: it measures each group, as measures: ["sum(amount)"]`);
    if (ONE_MEASURE.has(kind) && measures.length > 1) {
      return invalid(`${named} is a ${kind}, which draws one measure`);
    }
    if (kind === 'combo' && measures.length < 2) {
      return invalid(`${named} is a combo: bars and lines, so at least two measures`);
    }
    const checked = readAggregate(table.columns, { group, measures });
    if (!checked.ok) return invalid(`${named}: ${checked.error.message}`);
    if (kind === 'combo' && options['lines'] !== undefined) {
      const lines = options['lines'];
      if (!Array.isArray(lines) || !lines.every((line) => measures.includes(String(line)))) {
        return invalid(`${named} lists in options.lines measures it draws: ${measures.join(', ')}`);
      }
      if (lines.length >= measures.length) {
        return invalid(`${named} is a combo: at least one measure stays a bar`);
      }
    }
  } else if (kind === 'matrix') {
    if (!group || measures.length !== 1) {
      return invalid(
        `${named} is a matrix: its rows in source.group, one measure, and its columns in options.across`,
      );
    }
    const checked = readAggregate(table.columns, { group, measures });
    if (!checked.ok) return invalid(`${named}: ${checked.error.message}`);
    if (typeof options['across'] !== 'string') {
      return invalid(`${named} is a matrix: it names its columns in options.across`);
    }
    const across = readGrouping(table.columns, options['across']);
    if (!across.ok) return invalid(`${named}: ${across.error.message}`);
  } else {
    if (measures.length > 0 || group)
      return invalid(`${named} is a ${kind}, which draws rows and adds nothing up`);
  }

  // The columns the type names in its options are columns of its table.
  for (const option of OPTION_COLUMNS[kind]) {
    const value = options[option];
    if (value === undefined) continue;
    if (
      typeof value !== 'string' ||
      !table.columns.some((column) => sameColumnName(column.name, value))
    ) {
      return invalid(
        `${named} names "${String(value)}" as its ${option}, which "${table.name}" has no column called`,
      );
    }
  }
  if (kind === 'gantt' && (!options['title'] || !options['start'] || !options['end'])) {
    return invalid(`${named} is a Gantt: it names the columns of the title, the start and the end`);
  }
  if (kind === 'wbs') {
    if (!options['code'] || !options['title']) {
      return invalid(
        `${named} is a WBS: it names the column of its outline code, as 1.2.3, and of its title`,
      );
    }
    const numeric = ['progress', 'weight'].filter((option) => {
      const column = table.columns.find((each) =>
        sameColumnName(each.name, String(options[option])),
      );
      return column && column.type !== 'number' && column.type !== 'integer';
    });
    if (numeric.length > 0) {
      return invalid(`${named} reads ${numeric.join(' and ')} from a column of numbers`);
    }
  }
  if (kind === 'kanban') {
    if (!options['lane'] || !options['card'])
      return invalid(`${named} is a Kanban: it names the column of its lanes and of its cards`);
    const lane = readGrouping(table.columns, String(options['lane']));
    if (!lane.ok) return invalid(`${named}: ${lane.error.message}`);
  }
  if (kind === 'table') {
    const columns = options['columns'];
    if (columns !== undefined) {
      if (!Array.isArray(columns)) return invalid(`${named} lists its columns by name`);
      for (const name of columns) {
        if (!table.columns.some((column) => sameColumnName(column.name, String(name)))) {
          return invalid(
            `${named} shows "${String(name)}", which "${table.name}" has no column called`,
          );
        }
      }
    }
    const rules = options['rules'];
    if (rules !== undefined) {
      if (!Array.isArray(rules)) return invalid(`${named} lists its rules of formatting`);
      for (const rule of rules) {
        if (!isRecord(rule) || !['bar', 'scale', 'icons'].includes(String(rule['kind']))) {
          return invalid(`${named} formats a column as a bar, a scale or icons`);
        }
        const column = table.columns.find((each) =>
          sameColumnName(each.name, String(rule['column'])),
        );
        if (!column || (column.type !== 'number' && column.type !== 'integer')) {
          return invalid(
            `${named} formats "${String(rule['column'])}", which is not a number column of "${table.name}"`,
          );
        }
      }
    }
  }

  return ok({
    id,
    type: kind,
    title,
    slot,
    grid,
    source: { table: table.tableId, where: filter, group, measures },
    options,
  });
}

/** The definition as an answer carries it: each table by its name again. */
export function presentDefinition(
  definition: Definition,
  tables: readonly TableShape[],
): Record<string, unknown> {
  const nameOf = (id: string) => tables.find((table) => table.tableId === id)?.name ?? null;
  return {
    layout: definition.layout,
    refreshSeconds: definition.refreshSeconds,
    filters: definition.filters,
    components: definition.components.map((component) => ({
      id: component.id,
      type: component.type,
      ...(component.title ? { title: component.title } : {}),
      ...(component.slot ? { slot: component.slot } : {}),
      ...(component.grid ? { grid: component.grid } : {}),
      ...(component.source
        ? {
            source: {
              table: nameOf(component.source.table),
              ...(component.source.where ? { where: component.source.where } : {}),
              ...(component.source.group ? { group: component.source.group } : {}),
              ...(component.source.measures.length > 0
                ? { measures: component.source.measures }
                : {}),
            },
          }
        : {}),
      options: component.options,
    })),
  };
}

/** The tables a definition draws from, by identifier. */
export function tablesOf(definition: Definition): string[] {
  return [
    ...new Set(
      definition.components.flatMap((component) =>
        component.source ? [component.source.table] : [],
      ),
    ),
  ];
}
