import { useTranslation } from 'react-i18next';

/** What a transfer carries of one table (#366, RN-PRT-049). */
export type TableCarry = 'rows' | 'schema' | 'none';

/** The choice as the API takes it: the tables that go, each with or without its rows. */
export function tablesOf(
  carry: Readonly<Record<string, TableCarry>>,
  names: readonly string[],
): Array<{ name: string; rows: boolean }> | undefined {
  // Every table with its rows is what saying nothing means, so nothing is said.
  if (names.every((name) => (carry[name] ?? 'rows') === 'rows')) return undefined;
  return names
    .filter((name) => (carry[name] ?? 'rows') !== 'none')
    .map((name) => ({ name, rows: (carry[name] ?? 'rows') === 'rows' }));
}

/** A dashboard as a transfer reads it: what it is called and what it draws from (#368). */
export interface CarriedDashboard {
  readonly name: string;
  readonly definition: Readonly<Record<string, unknown>>;
}

/** The dashboards a choice leaves behind, because a table they draw from stays out (RN-PRT-053). */
export function dashboardsLeftOut(
  dashboards: readonly CarriedDashboard[],
  carry: Readonly<Record<string, TableCarry>>,
): Array<{ name: string; table: string }> {
  return dashboards.flatMap((dashboard) => {
    const components = (dashboard.definition['components'] ?? []) as Array<{
      source?: { table?: string | null };
    }>;
    const out = components.find(
      (each) => each.source?.table && carry[each.source.table] === 'none',
    );
    return out?.source?.table ? [{ name: dashboard.name, table: out.source.table }] : [];
  });
}

/**
 * The tables of a transfer, each with its rows, with its schema alone, or left
 * out (#366, RN-PRT-049): an export, an import and a version of a model ask it
 * the same way. The choice belongs to this transfer and is kept on nothing;
 * the notebook keeps its tables as they are.
 */
export function TableChoices({
  tables,
  carry,
  onCarry,
  hint,
  dashboards = [],
}: {
  /** The dashboards of the transfer, which a table left out takes with it. */
  dashboards?: readonly CarriedDashboard[];
  tables: ReadonlyArray<{ name: string; rows: number | null }>;
  carry: Readonly<Record<string, TableCarry>>;
  onCarry: (next: Record<string, TableCarry>) => void;
  /** What carrying rows means here, said under the heading. */
  hint?: string;
}) {
  const { t } = useTranslation();
  if (tables.length === 0) return null;
  return (
    <fieldset className="table-choices">
      <legend>{t('tables.carry.heading')}</legend>
      {hint ? <p className="table-choices-hint">{hint}</p> : null}
      <ul>
        {tables.map((table) => {
          const id = `table-carry-${table.name}`;
          // An archive that carries a table without rows has nothing to bring back but its schema.
          const rowsAvailable = table.rows !== null;
          return (
            <li key={table.name} className="table-choice">
              <label htmlFor={id}>
                {table.name}
                {table.rows !== null ? (
                  <span className="table-choice-rows">
                    {t('tables.rows', { count: table.rows })}
                  </span>
                ) : null}
              </label>
              <select
                id={id}
                value={carry[table.name] ?? (rowsAvailable ? 'rows' : 'schema')}
                onChange={(event) =>
                  onCarry({ ...carry, [table.name]: event.target.value as TableCarry })
                }
              >
                {rowsAvailable ? <option value="rows">{t('tables.carry.rows')}</option> : null}
                <option value="schema">{t('tables.carry.schema')}</option>
                <option value="none">{t('tables.carry.none')}</option>
              </select>
            </li>
          );
        })}
      </ul>
      {dashboardsLeftOut(dashboards, carry).map((left) => (
        <p key={left.name} className="table-choices-hint" role="status">
          {t('tables.carry.dashboardLeftOut', { dashboard: left.name, table: left.table })}
        </p>
      ))}
    </fieldset>
  );
}
