import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { NoteContent } from '../../shared/components/NoteContent';
import { queryKeys } from '../../shared/api/query-keys';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  SVGRenderer,
]);

/** A component of the definition, as the API answers it. */
export interface ComponentDefinition {
  id: string;
  type: string;
  title?: string;
  slot?: string;
  grid?: { x: number; y: number; w: number; h: number };
  source?: { table: string | null; where?: string; group?: string; measures?: string[] };
  options: Record<string, unknown>;
}

type Groups = Array<{ key: string | null; values: Array<number | string | null> }>;
type Rows = Array<{ rowId: string; values: Record<string, unknown> }>;
type Columns = Array<{ name: string; type: string }>;

/**
 * The colours of a chart, from the tokens of the brand (styles.css), read when
 * the chart is drawn so they follow light and dark.
 */
function palette(): string[] {
  const style = getComputedStyle(document.documentElement);
  return [
    '--chart-1',
    '--chart-2',
    '--chart-3',
    '--chart-4',
    '--chart-5',
    '--chart-6',
    '--chart-7',
    '--chart-8',
  ]
    .map((name) => style.getPropertyValue(name).trim())
    .filter((value) => value.length > 0);
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** A value in the format the component asks, in the reader's language. */
export function formatValue(
  value: unknown,
  options: Record<string, unknown>,
  locale: string,
): string {
  if (value === null || value === undefined || value === '') return '—';
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return String(value);
  const decimals = typeof options['decimals'] === 'number' ? options['decimals'] : undefined;
  const digits =
    decimals === undefined
      ? {}
      : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  switch (options['format']) {
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: typeof options['currency'] === 'string' ? options['currency'] : 'BRL',
        ...digits,
      }).format(number);
    case 'percent':
      return new Intl.NumberFormat(locale, { style: 'percent', ...digits }).format(number / 100);
    default:
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, ...digits }).format(number);
  }
}

export function Kpi({
  data,
  options,
  locale,
}: {
  data: { value?: unknown; compared?: unknown };
  options: Record<string, unknown>;
  locale: string;
}) {
  const { t } = useTranslation();
  const value = typeof data.value === 'number' ? data.value : Number(data.value ?? NaN);
  const compared = typeof data.compared === 'number' ? data.compared : Number(data.compared ?? NaN);
  const change =
    Number.isFinite(value) && Number.isFinite(compared) && compared !== 0
      ? (value - compared) / Math.abs(compared)
      : null;
  const goal = typeof options['goal'] === 'number' ? options['goal'] : null;
  return (
    <div className="dash-kpi">
      <span className="dash-kpi-value">{formatValue(data.value, options, locale)}</span>
      {change !== null ? (
        <span className={`dash-kpi-change ${change >= 0 ? 'is-up' : 'is-down'}`}>
          {change >= 0 ? '▲' : '▼'}{' '}
          {new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(
            Math.abs(change),
          )}{' '}
          <span className="dash-kpi-against">{t('dashboards.compared')}</span>
        </span>
      ) : null}
      {goal !== null && Number.isFinite(value) ? (
        <span className="dash-kpi-goal">
          <span className="dash-kpi-track">
            <span
              className="dash-kpi-fill"
              style={{ width: `${Math.max(0, Math.min(100, (value / goal) * 100))}%` }}
            />
          </span>
          {t('dashboards.ofGoal', { goal: formatValue(goal, options, locale) })}
        </span>
      ) : null}
    </div>
  );
}

export function Chart({
  type,
  groups,
  measures,
  options,
  locale,
}: {
  type: string;
  groups: Groups;
  measures: string[];
  options: Record<string, unknown>;
  locale: string;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const keys = groups.map((group) => group.key ?? t('dashboards.none'));
  const option = useMemo(() => {
    const colors = palette();
    const text = token('--text-soft');
    const border = token('--border');
    const format = (value: unknown) => formatValue(value, options, locale);
    const legend =
      options['legend'] !== false && (measures.length > 1 || type === 'pie' || type === 'donut');
    if (type === 'pie' || type === 'donut') {
      return {
        color: colors,
        tooltip: { trigger: 'item', valueFormatter: format },
        legend: legend ? { bottom: 0, textStyle: { color: text } } : undefined,
        series: [
          {
            type: 'pie',
            radius: type === 'donut' ? ['48%', '72%'] : '72%',
            center: ['50%', legend ? '44%' : '50%'],
            label: { show: options['labels'] !== false, color: text, formatter: '{b}: {d}%' },
            data: groups.map((group, index) => ({
              name: keys[index],
              value: Number(group.values[0] ?? 0),
            })),
          },
        ],
      };
    }
    const horizontal = type === 'bar' && options['horizontal'] === true;
    const percent = type === 'bar' && options['percent'] === true;
    const stacked = options['stacked'] === true || percent;
    const totals = groups.map((group) =>
      group.values.reduce<number>((sum, value) => sum + Number(value ?? 0), 0),
    );
    const category = {
      type: 'category',
      data: keys,
      axisLabel: { color: text },
      axisLine: { lineStyle: { color: border } },
    };
    const values = {
      type: 'value',
      axisLabel: {
        color: text,
        formatter: percent ? '{value}%' : (value: number) => format(value),
      },
      splitLine: { lineStyle: { color: border } },
      ...(percent ? { max: 100 } : {}),
    };
    return {
      color: colors,
      tooltip: {
        trigger: 'axis',
        valueFormatter: percent ? (value: number) => `${value.toFixed(1)}%` : format,
      },
      legend: legend ? { bottom: 0, textStyle: { color: text } } : undefined,
      grid: { left: 8, right: 16, top: 16, bottom: legend ? 36 : 8, containLabel: true },
      xAxis: horizontal ? values : category,
      yAxis: horizontal ? category : values,
      series: measures.map((measure, index) => ({
        name: measure,
        type: type === 'bar' ? 'bar' : 'line',
        smooth: options['smooth'] === true,
        ...(type === 'area' ? { areaStyle: { opacity: 0.25 } } : {}),
        ...(stacked ? { stack: 'all' } : {}),
        label: { show: options['labels'] === true, color: text },
        data: groups.map((group, at) => {
          const value = Number(group.values[index] ?? 0);
          return percent ? (totals[at] ? (value / (totals[at] as number)) * 100 : 0) : value;
        }),
      })),
    };
  }, [type, groups, measures, options, locale, keys]);

  useEffect(() => {
    if (!host.current) return undefined;
    const chart = echarts.init(host.current, undefined, { renderer: 'svg' });
    chart.setOption(option as echarts.EChartsCoreOption);
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      chart.dispose();
    };
  }, [option]);

  if (groups.length === 0) return <p className="dash-empty">{t('dashboards.noRows')}</p>;
  return <div ref={host} className="dash-chart" role="img" aria-label={measures.join(', ')} />;
}

/** The formatting a table component asks of a number column: a bar, a colour scale or icons. */
function ruleStyle(
  rule: Record<string, unknown>,
  value: number,
  min: number,
  max: number,
): { style?: React.CSSProperties; icon?: string } {
  const share = max === min ? 1 : (value - min) / (max - min);
  if (rule['kind'] === 'bar') {
    return {
      style: {
        backgroundImage: `linear-gradient(90deg, var(--chart-bar) ${share * 100}%, transparent ${share * 100}%)`,
      },
    };
  }
  if (rule['kind'] === 'scale') {
    return {
      style: {
        backgroundColor: `color-mix(in srgb, var(--seq-evergreen) ${Math.round(share * 45)}%, transparent)`,
      },
    };
  }
  return { icon: share >= 2 / 3 ? '▲' : share <= 1 / 3 ? '▼' : '●' };
}

export function RowsTable({
  columns,
  rows,
  total,
  options,
  page,
  onPage,
  locale,
}: {
  columns: Columns;
  rows: Rows;
  total: number;
  options: Record<string, unknown>;
  page: number;
  onPage: (page: number) => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const rules = Array.isArray(options['rules'])
    ? (options['rules'] as Array<Record<string, unknown>>)
    : [];
  const size = typeof options['pageSize'] === 'number' ? Math.min(100, options['pageSize']) : 10;
  const ranges = new Map(
    rules.map((rule) => {
      const values = rows
        .map((row) => Number(row.values[String(rule['column'])]))
        .filter(Number.isFinite);
      return [
        String(rule['column']),
        { min: Math.min(...values), max: Math.max(...values), rule },
      ] as const;
    }),
  );
  const pages = Math.max(1, Math.ceil(total / size));
  if (total === 0) return <p className="dash-empty">{t('dashboards.noRows')}</p>;
  return (
    <>
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.name}
                  scope="col"
                  className={numeric(column) ? 'is-numeric' : undefined}
                >
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowId}>
                {columns.map((column) => {
                  const value = row.values[column.name];
                  const range = ranges.get(column.name);
                  const styled =
                    range && typeof value === 'number'
                      ? ruleStyle(range.rule, value, range.min, range.max)
                      : {};
                  return (
                    <td
                      key={column.name}
                      className={numeric(column) ? 'is-numeric' : undefined}
                      style={styled.style}
                    >
                      {styled.icon ? <span className="dash-rule-icon">{styled.icon} </span> : null}
                      {cellText(column, value, locale, t)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav className="data-table-pages" aria-label={t('tables.pages')}>
          <span>
            {t('tables.showing', {
              first: (page - 1) * size + 1,
              last: Math.min(total, page * size),
              total,
            })}
          </span>
          <span className="data-table-page-buttons">
            <button
              type="button"
              className="button is-quiet is-small"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            >
              {t('tables.previous')}
            </button>
            <button
              type="button"
              className="button is-quiet is-small"
              disabled={page >= pages}
              onClick={() => onPage(page + 1)}
            >
              {t('tables.next')}
            </button>
          </span>
        </nav>
      ) : null}
    </>
  );
}

function numeric(column: { type: string }): boolean {
  return column.type === 'number' || column.type === 'integer';
}

function cellText(
  column: { type: string },
  value: unknown,
  locale: string,
  t: (key: string) => string,
): string {
  if (value === undefined || value === null) return '';
  if (numeric(column) && typeof value === 'number')
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(value);
  if (column.type === 'boolean') return value === true ? t('tables.true') : t('tables.false');
  if (column.type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).format(
      new Date(`${value}T00:00:00Z`),
    );
  }
  return Array.isArray(value) ? value.join(', ') : String(value);
}

/**
 * A Gantt (#368): a bar per row from its start to its end, filled as far as
 * its progress, against the months it spans; rows sharing a group stay together.
 */
export function Gantt({
  rows,
  options,
  locale,
}: {
  rows: Rows;
  options: Record<string, unknown>;
  locale: string;
}) {
  const { t } = useTranslation();
  const at = (value: unknown) =>
    typeof value === 'string'
      ? Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value)
      : NaN;
  const items = rows
    .map((row) => ({
      id: row.rowId,
      title: String(row.values[String(options['title'])] ?? ''),
      start: at(row.values[String(options['start'])]),
      end: at(row.values[String(options['end'])]),
      progress: options['progress'] ? Number(row.values[String(options['progress'])] ?? 0) : null,
      group: options['group'] ? String(row.values[String(options['group'])] ?? '') : '',
    }))
    .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end))
    .sort((a, b) => a.group.localeCompare(b.group) || a.start - b.start);
  if (items.length === 0) return <p className="dash-empty">{t('dashboards.noRows')}</p>;
  const from = Math.min(...items.map((item) => item.start));
  const to = Math.max(...items.map((item) => Math.max(item.end, item.start))) + 86_400_000;
  const span = to - from;
  const months: Array<{ label: string; left: number }> = [];
  const cursor = new Date(from);
  cursor.setUTCDate(1);
  while (cursor.getTime() < to) {
    const left = ((cursor.getTime() - from) / span) * 100;
    if (left >= 0) {
      months.push({
        label: new Intl.DateTimeFormat(locale, {
          month: 'short',
          year: '2-digit',
          timeZone: 'UTC',
        }).format(cursor),
        left,
      });
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'UTC' });
  return (
    <div className="dash-gantt">
      <div className="dash-gantt-scale" aria-hidden="true">
        {months.map((month) => (
          <span key={month.left} style={{ left: `${month.left}%` }}>
            {month.label}
          </span>
        ))}
      </div>
      <ul>
        {items.map((item) => {
          const left = ((item.start - from) / span) * 100;
          const width = Math.max(0.8, ((item.end + 86_400_000 - item.start) / span) * 100);
          return (
            <li key={item.id} className="dash-gantt-row">
              <span className="dash-gantt-title" title={item.title}>
                {item.group ? <span className="dash-gantt-group">{item.group} · </span> : null}
                {item.title}
              </span>
              <span className="dash-gantt-track">
                <span
                  className="dash-gantt-bar"
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${day.format(item.start)} – ${day.format(item.end)}`}
                >
                  {item.progress !== null ? (
                    <span
                      className="dash-gantt-done"
                      style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}
                    />
                  ) : null}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A Kanban (#368): a lane per value of a column, a card per row, in the order the lanes are named. */
export function Kanban({
  rows,
  total,
  options,
}: {
  rows: Rows;
  total: number;
  options: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const lane = String(options['lane']);
  const named = Array.isArray(options['lanes']) ? (options['lanes'] as unknown[]).map(String) : [];
  const lanes = [...named];
  for (const row of rows) {
    const value = String(row.values[lane] ?? t('dashboards.none'));
    if (!lanes.includes(value)) lanes.push(value);
  }
  const colors = palette();
  const colorColumn = typeof options['color'] === 'string' ? options['color'] : null;
  const shades = new Map<string, string>();
  return (
    <div className="dash-kanban">
      {lanes.map((name) => {
        const cards = rows.filter(
          (row) => String(row.values[lane] ?? t('dashboards.none')) === name,
        );
        return (
          <section key={name} className="dash-lane" aria-label={name}>
            <h3 className="dash-lane-head">
              {name} <span className="dash-lane-count">{cards.length}</span>
            </h3>
            <ul>
              {cards.map((row) => {
                const mark = colorColumn ? String(row.values[colorColumn] ?? '') : '';
                if (mark && !shades.has(mark))
                  shades.set(mark, colors[shades.size % Math.max(1, colors.length)] ?? '');
                return (
                  <li
                    key={row.rowId}
                    className="dash-card"
                    style={mark ? { borderLeftColor: shades.get(mark) } : undefined}
                  >
                    <span className="dash-card-title">
                      {String(row.values[String(options['card'])] ?? '')}
                    </span>
                    {options['detail'] ? (
                      <span className="dash-card-detail">
                        {String(row.values[String(options['detail'])] ?? '')}
                      </span>
                    ) : null}
                    {mark ? <span className="dash-card-mark">{mark}</span> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {total > rows.length ? (
        <p className="dash-empty">{t('dashboards.moreRows', { count: total - rows.length })}</p>
      ) : null}
    </div>
  );
}

export function TextBlock({ notebookId, markdown }: { notebookId: string; markdown: string }) {
  return (
    <NoteContent
      raw={markdown}
      notebookId={notebookId}
      baseRevision={null}
      writable={false}
      write={() => Promise.reject(new Error('A dashboard writes nothing.'))}
      invalidates={queryKeys.notebookDashboards(notebookId)}
      actions={false}
    />
  );
}
