/**
 * The tables and dashboards a transfer carries (#399), chosen as every other
 * species of the chooser is: they travel or not, and when they do, all of them
 * or item by item. A table goes with its schema and rows or with its schema
 * alone (RN-PRT-057), a dashboard goes or stays (RN-PRT-072), and a dashboard
 * chosen whose table stays out is an inconsistency the choice says, and which
 * stops the transfer until it is resolved.
 */

/** What a transfer carries of one table. */
export type TableCarry = 'rows' | 'schema' | 'none';

export interface TablesChoice {
  /** Whether tables and dashboards travel at all. */
  readonly on: boolean;
  /** All of them, or item by item in their tab. */
  readonly reach: 'all' | 'choose';
  /** Item by item: each table, by name; absent is with its rows when it has them. */
  readonly carry: Readonly<Record<string, TableCarry>>;
  /** Item by item: each dashboard, by name; absent is that it goes. */
  readonly dashboards: Readonly<Record<string, boolean>>;
}

/** Every table with its rows and every dashboard: what the whole notebook carries. */
export const EVERY_TABLE: TablesChoice = { on: true, reach: 'all', carry: {}, dashboards: {} };

/** A table on offer; `rows` is null when the archive carries its schema alone. */
export interface OfferedTable {
  readonly name: string;
  readonly rows: number | null;
}

/** A dashboard on offer: its name, and the definition that says which tables it draws from. */
export interface OfferedDashboard {
  readonly name: string;
  readonly definition: Readonly<Record<string, unknown>>;
}

const same = (a: string, b: string): boolean =>
  a.normalize('NFC').toLowerCase() === b.normalize('NFC').toLowerCase();

/** The tables a dashboard draws from. */
export function tablesOfDashboard(dashboard: OfferedDashboard): string[] {
  const components = (dashboard.definition['components'] ?? []) as Array<{
    source?: { table?: string | null };
  }>;
  const names: string[] = [];
  for (const component of components) {
    const table = component.source?.table;
    if (table && !names.some((each) => same(each, table))) names.push(table);
  }
  return names;
}

/** What goes of one table under the choice. */
export function carryOf(choice: TablesChoice, table: OfferedTable): TableCarry {
  const most: TableCarry = table.rows === null ? 'schema' : 'rows';
  if (!choice.on) return 'none';
  if (choice.reach === 'all') return most;
  const chosen = choice.carry[table.name] ?? most;
  // An archive that carries a schema alone has no rows to bring back.
  return chosen === 'rows' && table.rows === null ? 'schema' : chosen;
}

/** Whether one dashboard goes under the choice, its tables aside. */
export function dashboardChosen(choice: TablesChoice, dashboard: OfferedDashboard): boolean {
  if (!choice.on) return false;
  if (choice.reach === 'all') return true;
  return choice.dashboards[dashboard.name] ?? true;
}

/**
 * The dashboards chosen whose table stays out, each with the first such table:
 * a dashboard cannot be drawn without what it draws from.
 */
export function inconsistentDashboards(
  choice: TablesChoice,
  tables: readonly OfferedTable[],
  dashboards: readonly OfferedDashboard[],
): Array<{ dashboard: string; table: string }> {
  return dashboards.flatMap((dashboard) => {
    if (!dashboardChosen(choice, dashboard)) return [];
    const missing = tablesOfDashboard(dashboard).find((name) => {
      const table = tables.find((each) => same(each.name, name));
      return !table || carryOf(choice, table) === 'none';
    });
    return missing ? [{ dashboard: dashboard.name, table: missing }] : [];
  });
}

/** How many tables and dashboards go, for the summary and the first tab. */
export function carriedTables(
  choice: TablesChoice,
  tables: readonly OfferedTable[],
  dashboards: readonly OfferedDashboard[],
): { tables: number; dashboards: number } {
  const broken = new Set(
    inconsistentDashboards(choice, tables, dashboards).map((each) => each.dashboard),
  );
  return {
    tables: tables.filter((table) => carryOf(choice, table) !== 'none').length,
    dashboards: dashboards.filter(
      (dashboard) => dashboardChosen(choice, dashboard) && !broken.has(dashboard.name),
    ).length,
  };
}

/**
 * What the API is told. Nothing said is every table with its rows and every
 * dashboard whose tables go, which is the whole notebook and *all of them*.
 */
export function transferTablesOf(
  wholeNotebook: boolean,
  choice: TablesChoice,
  tables: readonly OfferedTable[],
  dashboards: readonly OfferedDashboard[],
): { tables?: Array<{ name: string; rows: boolean }>; dashboards?: string[] } {
  if (wholeNotebook || (choice.on && choice.reach === 'all')) return {};
  if (!choice.on) return { tables: [], dashboards: [] };
  return {
    tables: tables
      .filter((table) => carryOf(choice, table) !== 'none')
      .map((table) => ({ name: table.name, rows: carryOf(choice, table) === 'rows' })),
    dashboards: dashboards
      .filter((dashboard) => dashboardChosen(choice, dashboard))
      .map((dashboard) => dashboard.name),
  };
}
