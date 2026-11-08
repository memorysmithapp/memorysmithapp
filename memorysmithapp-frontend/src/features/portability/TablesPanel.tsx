import { useTranslation } from 'react-i18next';
import { Segmented } from '../../shared/components/Segmented';
import {
  carryOf,
  dashboardChosen,
  inconsistentDashboards,
  type OfferedDashboard,
  type OfferedTable,
  type TableCarry,
  type TablesChoice,
} from './tables-choice';

/**
 * The tab of tables and dashboards (#399), item by item, as every other tab of
 * the chooser: a box each, a table with its schema alone or with its rows too,
 * and a dashboard whose table stays out marked, saying which.
 */
export function TablesPanel({
  tables,
  dashboards,
  choice,
  onChoice,
}: {
  tables: readonly OfferedTable[];
  dashboards: readonly OfferedDashboard[];
  choice: TablesChoice;
  onChoice: (next: TablesChoice) => void;
}) {
  const { t } = useTranslation();
  const broken = new Map(
    inconsistentDashboards(choice, tables, dashboards).map((each) => [each.dashboard, each.table]),
  );
  const setCarry = (name: string, carry: TableCarry) =>
    onChoice({ ...choice, carry: { ...choice.carry, [name]: carry } });
  const allTables = (on: boolean) =>
    onChoice({
      ...choice,
      carry: Object.fromEntries(
        tables.map((table) => [
          table.name,
          on ? (table.rows === null ? 'schema' : 'rows') : ('none' as TableCarry),
        ]),
      ),
    });
  const allDashboards = (on: boolean) =>
    onChoice({
      ...choice,
      dashboards: Object.fromEntries(dashboards.map((each) => [each.name, on])),
    });

  return (
    <div className="chooser-scroll tables-panel">
      {tables.length > 0 ? (
        <section className="tables-panel-group">
          <div className="tables-panel-head">
            <h3>{t('portability.tables.tables')}</h3>
            <button
              type="button"
              className="button is-quiet is-small"
              onClick={() => allTables(true)}
            >
              {t('portability.tables.all')}
            </button>
            <button
              type="button"
              className="button is-quiet is-small"
              onClick={() => allTables(false)}
            >
              {t('portability.tables.none')}
            </button>
          </div>
          <ul className="chooser-list" role="list">
            {tables.map((table) => {
              const carry = carryOf(choice, table);
              return (
                <li key={table.name} className="chooser-row is-table">
                  <label className="chooser-label">
                    <input
                      type="checkbox"
                      className="box"
                      checked={carry !== 'none'}
                      onChange={(event) =>
                        setCarry(
                          table.name,
                          event.target.checked ? (table.rows === null ? 'schema' : 'rows') : 'none',
                        )
                      }
                    />
                    <span className="chooser-name">{table.name}</span>
                  </label>
                  {table.rows !== null ? (
                    <span className="chooser-note">{t('tables.rows', { count: table.rows })}</span>
                  ) : null}
                  {carry !== 'none' ? (
                    // The same control as Everything or Choose items beside it (#404);
                    // a table the archive carries without rows offers its schema alone.
                    <span className="chooser-reach">
                      <Segmented
                        label={t('portability.tables.carryOf', { table: table.name })}
                        value={carry}
                        onChange={(next) => setCarry(table.name, next)}
                        options={[
                          { value: 'schema' as const, label: t('portability.tables.schema') },
                          {
                            value: 'rows' as const,
                            label: t('portability.tables.schemaAndRows'),
                            disabled: table.rows === null,
                          },
                        ]}
                      />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {dashboards.length > 0 ? (
        <section className="tables-panel-group">
          <div className="tables-panel-head">
            <h3>{t('portability.tables.dashboards')}</h3>
            <button
              type="button"
              className="button is-quiet is-small"
              onClick={() => allDashboards(true)}
            >
              {t('portability.tables.all')}
            </button>
            <button
              type="button"
              className="button is-quiet is-small"
              onClick={() => allDashboards(false)}
            >
              {t('portability.tables.none')}
            </button>
          </div>
          <ul className="chooser-list" role="list">
            {dashboards.map((dashboard) => {
              const table = broken.get(dashboard.name);
              return (
                <li
                  key={dashboard.name}
                  className={`chooser-row is-dashboard${table ? ' is-twin' : ''}`}
                >
                  <label className="chooser-label">
                    <input
                      type="checkbox"
                      className="box"
                      checked={dashboardChosen(choice, dashboard)}
                      onChange={(event) =>
                        onChoice({
                          ...choice,
                          dashboards: {
                            ...choice.dashboards,
                            [dashboard.name]: event.target.checked,
                          },
                        })
                      }
                    />
                    <span className="chooser-name">{dashboard.name}</span>
                  </label>
                  {table ? (
                    <span className="chooser-note is-wrong" role="alert">
                      {t('portability.tables.needsTable', { table })}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
