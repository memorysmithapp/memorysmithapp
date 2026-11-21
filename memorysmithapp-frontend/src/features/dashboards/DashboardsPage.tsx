import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type {
  ComponentDataDto,
  DashboardCrossFilter,
  NotebookDashboardDto,
} from '@memorysmithapp/contracts';
import { NotebookBar } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import { useDocumentTitle } from '../../shared/components/document-title';
import { dashboardImage, listDashboards, readDashboardData } from '../../shared/api/source';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { namesSystemNotesTable } from '@memorysmithapp/contracts';
import { dashboardsAddress, noteAddress } from '../../shared/api/note-address';
import { useLiveInterval } from '../../shared/api/live';
import { SkeletonBar, SkeletonRegion } from '../../shared/components/Skeleton';
import { DashboardIcon, DownloadIcon } from '../../shared/components/icons';
import { ActionWord } from '../../shared/components/ActionWord';
import { intlLocale } from '../../i18n/intl-locale';
import {
  Chart,
  type ComponentDefinition,
  Gantt,
  Gauge,
  Heatmap,
  Kanban,
  Kpi,
  Matrix,
  RowsTable,
  Scatter,
  TextBlock,
  Timeline,
  Wbs,
} from './components';

/** What a component without an answer draws from, the same array on every render (#489). */
const NONE = Object.freeze([]) as never;

/** How long the head says a read brought new values (#489). */
const FRESH_MS = 2500;

/** What sits beside its like in the header of a dashboard. */
const HEADLINE: ReadonlySet<string> = new Set(['kpi', 'gauge']);

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
 * declared.
 *
 * Nothing is written here (#487): a dashboard is built, changed and deleted by
 * an agent, through the connector, as a table is (#462). The page is how a
 * person sees what the agent built.
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
      <article className={`content-pane is-wide dashboards-page${chosen ? ' is-open' : ''}`}>
        {dashboards.isError ? (
          <p className="status">{t(messageKeyOf(dashboards.error))}</p>
        ) : !dashboards.data ? (
          <SkeletonRegion>
            <SkeletonBar width="40%" />
            <SkeletonBar width="70%" height="0.8rem" />
          </SkeletonRegion>
        ) : chosen ? (
          <DashboardView notebookId={notebookId} dashboard={chosen} locale={locale} />
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
  still = false,
  onDrawn,
  view = null,
}: {
  notebookId: string;
  dashboard: NotebookDashboardDto;
  locale: string;
  /** Drawn for an image (#368): nothing moves, nothing is offered, and it says when it is drawn. */
  still?: boolean;
  onDrawn?: ((root: HTMLElement | null) => void) | undefined;
  /** What an image shows of the dashboard as the person saw it (#369). */
  view?: {
    filters: Record<string, string | null> | null;
    cross: DashboardCrossFilter | null;
  } | null;
}) {
  const { t } = useTranslation();
  const root = useRef<HTMLElement>(null);
  const definition = dashboard.definition as {
    layout?: string;
    refreshSeconds?: number | null;
    filters?: Filter[];
    components?: ComponentDefinition[];
  };
  const filters = definition.filters ?? [];
  const components = definition.components ?? [];
  const [chosen, setChosen] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      filters.map((filter) => [
        filter.id,
        view?.filters && filter.id in view.filters
          ? (view.filters[filter.id] ?? null)
          : filter.default,
      ]),
    ),
  );
  const [cross, setCross] = useState<DashboardCrossFilter | null>(view?.cross ?? null);
  const [pages, setPages] = useState<Record<string, number>>({});
  const [drawing, setDrawing] = useState(false);
  /** A read the person asked for with Refresh, the only one that holds the button (#489). */
  const [asked, setAsked] = useState(false);
  /** A read that brought values other than those on the screen, said for a moment (#489). */
  const [fresh, setFresh] = useState(false);
  const seen = useRef<{ key: string; components: unknown } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const { i18n } = useTranslation();
  const request = { filters: chosen, pages, cross };

  /** The dashboard as a PNG, drawn by the server as this person reads it (RN-PRT-032). */
  async function download(): Promise<void> {
    setDrawing(true);
    setImageFailed(false);
    try {
      const image = await dashboardImage(notebookId, dashboard.name, i18n.language, {
        filters: chosen,
        cross,
      });
      const address = URL.createObjectURL(image);
      const anchor = document.createElement('a');
      anchor.href = address;
      anchor.download = `${dashboard.name}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(address), 10_000);
    } catch {
      setImageFailed(true);
    } finally {
      setDrawing(false);
    }
  }
  const data = useQuery({
    queryKey: queryKeys.dashboardData(notebookId, dashboard.name, request),
    queryFn: () => readDashboardData(notebookId, dashboard.name, chosen, pages, cross),
    placeholderData: keepPreviousData,
    // A dashboard is read again when the page is looked at again, and on the
    // interval the agent declared, never more often than a minute (#368).
    refetchOnWindowFocus: true,
    refetchInterval: !still && definition.refreshSeconds ? definition.refreshSeconds * 1000 : false,
  });
  const byId = new Map((data.data?.components ?? []).map((component) => [component.id, component]));
  // A read is told in the head, never by the charts (#489): the components keep
  // their identity across reads that bring the same values, so only a read of
  // the same periods and marks that changed them counts as an update. What the
  // person chose themselves is not announced, and neither is the first read.
  const answeredFor = JSON.stringify(request);
  const answeredWith = data.isPlaceholderData ? undefined : data.data?.components;
  useEffect(() => {
    if (!answeredWith) return;
    const before = seen.current;
    seen.current = { key: answeredFor, components: answeredWith };
    if (before && before.key === answeredFor && before.components !== answeredWith) setFresh(true);
  }, [answeredFor, answeredWith]);
  useEffect(() => {
    if (!fresh) return undefined;
    const done = setTimeout(() => setFresh(false), FRESH_MS);
    return () => clearTimeout(done);
  }, [fresh]);
  async function refresh(): Promise<void> {
    setAsked(true);
    try {
      await data.refetch();
    } finally {
      setAsked(false);
    }
  }
  const reading = data.isFetching && data.data !== undefined;
  const readAt = data.data
    ? new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(data.data.readAt))
    : null;
  const layout = definition.layout ?? 'one-column';
  // The indicators of a header share its width, side by side.
  const headline = components.filter(
    (component) => component.slot === 'header' && HEADLINE.has(component.type),
  ).length;
  /** A click on a mark narrows the other components, and on the same mark clears it (#369). */
  function mark(component: string, key: string): void {
    setPages({});
    setCross(cross?.component === component && cross.key === key ? null : { component, key });
  }
  const answered = data.data !== undefined;
  useEffect(() => {
    if (answered && onDrawn) onDrawn(root.current);
  }, [answered, onDrawn]);

  return (
    <section className="dashboard" data-layout={layout} ref={root}>
      {/* The name, the actions and the description each hold an area of
          their own, so a long description never moves the actions (#387). */}
      <header className="dashboard-head">
        <h1 className="table-detail-name dashboard-name">{dashboard.name}</h1>
        {dashboard.description ? (
          <p className="table-detail-desc dashboard-desc">{dashboard.description}</p>
        ) : null}
        {still ? null : (
          <div className="dashboard-actions">
            {readAt ? (
              <span
                className="dashboard-read"
                data-state={reading ? 'reading' : fresh ? 'fresh' : undefined}
              >
                <span className="dashboard-read-dot" aria-hidden="true" />
                {t('dashboards.readAt', { time: readAt })}
              </span>
            ) : null}
            <span className="visually-hidden" role="status">
              {fresh ? t('dashboards.updated') : ''}
            </span>
            <button
              type="button"
              className="button is-quiet is-small"
              onClick={() => void refresh()}
              disabled={asked}
            >
              {t('dashboards.refresh')}
            </button>
            <button
              type="button"
              className="button is-quiet is-small"
              disabled={drawing}
              onClick={() => void download()}
            >
              <ActionWord
                icon={<DownloadIcon />}
                word={drawing ? t('dashboards.drawing') : t('dashboards.downloadImage')}
              />
            </button>
          </div>
        )}
      </header>

      {filters.length > 0 ? (
        <div className="dashboard-filters">
          {filters.map((filter) => (
            <PeriodSlicer
              still={still}
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

      {cross ? (
        <p className="dashboard-cross" role="status">
          {t('dashboards.crossFilter', { key: cross.key })}
          {still ? null : (
            <button
              type="button"
              className="button is-quiet is-small"
              onClick={() => mark(cross.component, cross.key)}
            >
              {t('dashboards.clearFilter')}
            </button>
          )}
        </p>
      ) : null}

      {data.isError ? <p className="status">{t(messageKeyOf(data.error))}</p> : null}
      {imageFailed ? (
        <p className="status" role="alert">
          {t('dashboards.imageFailed')}
        </p>
      ) : null}

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
                : component.slot === 'header' && HEADLINE.has(component.type)
                  ? ({
                      '--headline-span': Math.max(2, Math.floor(12 / headline)),
                    } as React.CSSProperties)
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
              still={still}
              selected={cross?.component === component.id ? cross.key : null}
              onMark={still ? undefined : (key) => mark(component.id, key)}
            />
          </section>
        ))}
      </div>
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
  still,
  selected,
  onMark,
}: {
  still: boolean;
  selected: string | null;
  onMark: ((key: string) => void) | undefined;
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
  // A row of `system-notes` is a note and leads to it, except on a dashboard
  // drawn still, for a picture or a print (#524).
  const table = component.source?.table;
  const noteOf =
    !still && table && namesSystemNotesTable(table)
      ? (rowId: string) => noteAddress(notebookId, rowId)
      : undefined;
  switch (component.type) {
    case 'kpi':
      return <Kpi data={answer as never} options={component.options} locale={locale} />;
    case 'pie':
    case 'donut':
    case 'bar':
    case 'line':
    case 'area':
    case 'combo':
    case 'waterfall':
    case 'funnel':
    case 'treemap':
    case 'calendar':
      return (
        <Chart
          type={component.type}
          groups={(answer['groups'] as never) ?? NONE}
          measures={(answer['measures'] as string[]) ?? NONE}
          options={component.options}
          locale={locale}
          still={still}
          selected={selected}
          onMark={onMark}
        />
      );
    case 'gauge':
      return (
        <Gauge value={answer['value']} options={component.options} locale={locale} still={still} />
      );
    case 'scatter':
      return (
        <Scatter
          rows={(answer['rows'] as never) ?? NONE}
          options={component.options}
          locale={locale}
          still={still}
        />
      );
    case 'heatmap':
      return (
        <Heatmap data={answer as never} options={component.options} locale={locale} still={still} />
      );
    case 'timeline':
      return (
        <Timeline
          rows={(answer['rows'] as never) ?? NONE}
          options={component.options}
          locale={locale}
          noteOf={noteOf}
        />
      );
    case 'wbs':
      return <Wbs rows={(answer['rows'] as never) ?? NONE} options={component.options} />;
    case 'matrix':
      return <Matrix data={answer as never} options={component.options} locale={locale} />;
    case 'table':
      return (
        <RowsTable
          columns={(answer['columns'] as never) ?? NONE}
          rows={(answer['rows'] as never) ?? NONE}
          total={Number(answer['total'] ?? 0)}
          options={component.options}
          page={page}
          onPage={onPage}
          locale={locale}
          noteOf={noteOf}
        />
      );
    case 'gantt':
      return (
        <Gantt
          rows={(answer['rows'] as never) ?? NONE}
          options={component.options}
          locale={locale}
        />
      );
    case 'kanban':
      return (
        <Kanban
          rows={(answer['rows'] as never) ?? NONE}
          total={Number(answer['total'] ?? 0)}
          options={component.options}
          noteOf={noteOf}
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
  still,
}: {
  /** On an image a period is said, and offers nothing. */
  still: boolean;
  filter: Filter;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  const grain = (filter.default ?? value ?? '0000-00').length;
  const id = `period-${filter.id}`;
  if (still) {
    return (
      <p className="dashboard-slicer">
        <strong>{filter.label}</strong> {value ?? t('dashboards.allPeriods')}
      </p>
    );
  }
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
