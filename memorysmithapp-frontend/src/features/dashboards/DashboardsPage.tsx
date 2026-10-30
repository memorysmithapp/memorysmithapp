import { useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ComponentDataDto, NotebookDashboardDto } from '@memorysmithapp/contracts';
import { NotebookBar } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import { useDocumentTitle } from '../../shared/components/document-title';
import { deleteDashboard, listDashboards, readDashboardData } from '../../shared/api/source';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { dashboardsAddress } from '../../shared/api/note-address';
import { useLiveInterval } from '../../shared/api/live';
import { Modal } from '../../shared/components/Modal';
import { SkeletonBar, SkeletonRegion } from '../../shared/components/Skeleton';
import { DashboardIcon, TrashIcon } from '../../shared/components/icons';
import { ActionWord } from '../../shared/components/ActionWord';
import { intlLocale } from '../../i18n/intl-locale';
import {
  Chart,
  type ComponentDefinition,
  Gantt,
  Kanban,
  Kpi,
  RowsTable,
  TextBlock,
} from './components';

interface Filter {
  id: string;
  label: string;
  column: string;
  default: string | null;
}

/**
 * The Dashboards of a notebook (#368, RN-KNW-083): what an agent built over its
 * Tables, drawn here and nowhere else. A dashboard keeps no data: it is
 * computed from its tables each time it is read, when the page opens, when the
 * tab is looked at again, when the person asks, and on the interval the agent
 * declared. Nothing is written here but a deletion, for whoever maintains the
 * notebook.
 */
export function DashboardsPage() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const live = useLiveInterval();
  const [params, setParams] = useSearchParams();
  const open = params.get('dashboard');

  useDocumentTitle(t('dashboards.heading'), structure.notebook.name);

  const dashboards = useQuery({
    queryKey: queryKeys.notebookDashboards(notebookId),
    refetchInterval: live,
    queryFn: () => listDashboards(notebookId),
  });
  const sorted = useMemo(
    () => [...(dashboards.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, locale)),
    [dashboards.data, locale],
  );
  const chosen = sorted.find((each) => each.name === open) ?? null;
  const choose = (name: string | null) => {
    const next = new URLSearchParams(params);
    if (name) next.set('dashboard', name);
    else next.delete('dashboard');
    setParams(next, { replace: true });
  };

  return (
    <>
      <NotebookBar
        crumbs={
          chosen
            ? [
                { label: t('dashboards.heading'), to: dashboardsAddress(notebookId) },
                { label: chosen.name },
              ]
            : [{ label: t('dashboards.heading') }]
        }
      />
      <article className={`content-pane dashboards-page${chosen ? ' is-open' : ''}`}>
        {dashboards.isError ? (
          <p className="status">{t(messageKeyOf(dashboards.error))}</p>
        ) : !dashboards.data ? (
          <SkeletonRegion>
            <SkeletonBar width="40%" />
            <SkeletonBar width="70%" height="0.8rem" />
          </SkeletonRegion>
        ) : chosen ? (
          <DashboardView
            notebookId={notebookId}
            dashboard={chosen}
            locale={locale}
            maintains={structure.permissions.maintain}
            onDeleted={() => choose(null)}
          />
        ) : (
          <>
            <p className="page-intro">{t('dashboards.intro')}</p>
            {sorted.length === 0 ? (
              <p>{t('dashboards.none')}</p>
            ) : (
              <ul className="row-card table-list">
                {sorted.map((dashboard) => (
                  <li key={dashboard.dashboardId} className="table-row">
                    <button
                      type="button"
                      className="table-row-open"
                      onClick={() => choose(dashboard.name)}
                    >
                      <span className="table-row-icon" aria-hidden="true">
                        <DashboardIcon width={20} height={20} />
                      </span>
                      <span className="table-row-text">
                        <span className="table-row-name">{dashboard.name}</span>
                        <span className="table-row-meta">
                          {t('dashboards.components', {
                            count:
                              (dashboard.definition['components'] as unknown[] | undefined)
                                ?.length ?? 0,
                          })}
                        </span>
                        {dashboard.description ? (
                          <span className="table-row-desc">{dashboard.description}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </article>
    </>
  );
}

export function DashboardView({
  notebookId,
  dashboard,
  locale,
  maintains,
  onDeleted,
}: {
  notebookId: string;
  dashboard: NotebookDashboardDto;
  locale: string;
  maintains: boolean;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const definition = dashboard.definition as {
    layout?: string;
    refreshSeconds?: number | null;
    filters?: Filter[];
    components?: ComponentDefinition[];
  };
  const filters = definition.filters ?? [];
  const components = definition.components ?? [];
  const [chosen, setChosen] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(filters.map((filter) => [filter.id, filter.default])),
  );
  const [pages, setPages] = useState<Record<string, number>>({});
  const [deleting, setDeleting] = useState(false);
  const request = { filters: chosen, pages };
  const data = useQuery({
    queryKey: queryKeys.dashboardData(notebookId, dashboard.name, request),
    queryFn: () => readDashboardData(notebookId, dashboard.name, chosen, pages),
    placeholderData: keepPreviousData,
    // A dashboard is read again when the page is looked at again, and on the
    // interval the agent declared, never more often than a minute (#368).
    refetchOnWindowFocus: true,
    refetchInterval: definition.refreshSeconds ? definition.refreshSeconds * 1000 : false,
  });
  const byId = new Map((data.data?.components ?? []).map((component) => [component.id, component]));
  const readAt = data.data
    ? new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(data.data.readAt))
    : null;
  const layout = definition.layout ?? 'one-column';

  return (
    <section className="dashboard" data-layout={layout}>
      <header className="dashboard-head">
        <div>
          <h1 className="table-detail-name">{dashboard.name}</h1>
          {dashboard.description ? (
            <p className="table-detail-desc">{dashboard.description}</p>
          ) : null}
        </div>
        <div className="dashboard-actions">
          {readAt ? (
            <span className="dashboard-read">{t('dashboards.readAt', { time: readAt })}</span>
          ) : null}
          <button
            type="button"
            className="button is-quiet is-small"
            onClick={() => void data.refetch()}
            disabled={data.isFetching}
          >
            {t('dashboards.refresh')}
          </button>
          {maintains && onDeleted ? (
            <button
              type="button"
              className="button is-quiet is-small is-danger"
              onClick={() => setDeleting(true)}
            >
              <ActionWord icon={<TrashIcon />} word={t('dashboards.delete')} />
            </button>
          ) : null}
        </div>
      </header>

      {filters.length > 0 ? (
        <div className="dashboard-filters">
          {filters.map((filter) => (
            <PeriodSlicer
              key={filter.id}
              filter={filter}
              value={chosen[filter.id] ?? null}
              onChange={(value) => {
                setPages({});
                setChosen({ ...chosen, [filter.id]: value });
              }}
            />
          ))}
        </div>
      ) : null}

      {data.isError ? <p className="status">{t(messageKeyOf(data.error))}</p> : null}

      <div className="dashboard-grid" data-layout={layout}>
        {components.map((component) => (
          <section
            key={component.id}
            className={`dashboard-card is-${component.type}`}
            data-slot={component.slot}
            style={
              component.grid
                ? {
                    gridColumn: `${component.grid.x + 1} / span ${component.grid.w}`,
                    gridRow: `${component.grid.y + 1} / span ${component.grid.h}`,
                  }
                : undefined
            }
          >
            {component.title ? <h2 className="dashboard-card-title">{component.title}</h2> : null}
            <ComponentBody
              notebookId={notebookId}
              component={component}
              data={byId.get(component.id)}
              locale={locale}
              page={pages[component.id] ?? 1}
              onPage={(page) => setPages({ ...pages, [component.id]: page })}
            />
          </section>
        ))}
      </div>

      {deleting && onDeleted ? (
        <DeleteDashboardDialog
          notebookId={notebookId}
          dashboard={dashboard}
          onClose={() => setDeleting(false)}
          onDeleted={onDeleted}
        />
      ) : null}
    </section>
  );
}

function ComponentBody({
  notebookId,
  component,
  data,
  locale,
  page,
  onPage,
}: {
  notebookId: string;
  component: ComponentDefinition;
  data: ComponentDataDto | undefined;
  locale: string;
  page: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  if (component.type === 'text') {
    return (
      <TextBlock notebookId={notebookId} markdown={String(component.options['markdown'] ?? '')} />
    );
  }
  if (!data) {
    return (
      <SkeletonRegion>
        <SkeletonBar width="100%" height="6rem" />
      </SkeletonRegion>
    );
  }
  if (data.status === 'missing-table')
    return <p className="dash-problem">{t('dashboards.missingTable')}</p>;
  if (data.status === 'refused')
    return <p className="dash-problem">{String(data.message ?? '')}</p>;
  const answer = data as Record<string, unknown>;
  switch (component.type) {
    case 'kpi':
      return <Kpi data={answer as never} options={component.options} locale={locale} />;
    case 'pie':
    case 'donut':
    case 'bar':
    case 'line':
    case 'area':
      return (
        <Chart
          type={component.type}
          groups={(answer['groups'] as never) ?? []}
          measures={(answer['measures'] as string[]) ?? []}
          options={component.options}
          locale={locale}
        />
      );
    case 'table':
      return (
        <RowsTable
          columns={(answer['columns'] as never) ?? []}
          rows={(answer['rows'] as never) ?? []}
          total={Number(answer['total'] ?? 0)}
          options={component.options}
          page={page}
          onPage={onPage}
          locale={locale}
        />
      );
    case 'gantt':
      return (
        <Gantt rows={(answer['rows'] as never) ?? []} options={component.options} locale={locale} />
      );
    case 'kanban':
      return (
        <Kanban
          rows={(answer['rows'] as never) ?? []}
          total={Number(answer['total'] ?? 0)}
          options={component.options}
        />
      );
    default:
      return null;
  }
}

/**
 * A period of the dashboard (#368): a month by default, a year or a day when
 * that is what the agent declared, or every period.
 */
function PeriodSlicer({
  filter,
  value,
  onChange,
}: {
  filter: Filter;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  const grain = (filter.default ?? value ?? '0000-00').length;
  const id = `period-${filter.id}`;
  return (
    <div className="dashboard-slicer">
      <label htmlFor={id}>{filter.label}</label>
      {grain === 10 ? (
        <input
          id={id}
          type="date"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
        />
      ) : grain === 4 ? (
        <input
          id={id}
          type="number"
          min={1900}
          max={2999}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
        />
      ) : (
        <input
          id={id}
          type="month"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
        />
      )}
      <button
        type="button"
        className="button is-quiet is-small"
        disabled={value === null}
        onClick={() => onChange(null)}
      >
        {t('dashboards.allPeriods')}
      </button>
    </div>
  );
}

function DeleteDashboardDialog({
  notebookId,
  dashboard,
  onClose,
  onDeleted,
}: {
  notebookId: string;
  dashboard: NotebookDashboardDto;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  async function remove(): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      await deleteDashboard(notebookId, dashboard.name);
      await client.invalidateQueries({ queryKey: queryKeys.notebookDashboards(notebookId) });
      onDeleted();
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title={t('dashboards.deleteTitle')}
      subtitle={dashboard.name}
      onClose={onClose}
      className="move-dialog folder-delete-dialog"
    >
      <div className="folder-delete">
        <p>{t('dashboards.deleteConsequences')}</p>
        {failure ? (
          <p className="move-refusal" role="alert">
            {failure}
          </p>
        ) : null}
        <div className="ask-dialog-foot">
          <button type="button" className="button is-quiet" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="button is-danger is-filled"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? t('tables.deleting') : t('dashboards.deleteConfirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
