import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as echarts from 'echarts/core';
import {
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
  TreemapChart,
} from 'echarts/charts';
import {
  CalendarComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { NoteContent } from '../../shared/components/NoteContent';
import { queryKeys } from '../../shared/api/query-keys';
import { wbsLines, wbsTree } from './wbs';

echarts.use([
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
  TreemapChart,
  CalendarComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
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

/** What a legend says of a measure: the name the agent gave, or the column measured. */
export function measureName(
  measure: string,
  options: Record<string, unknown>,
  count: string,
): string {
  const names = options['names'] as Record<string, string> | undefined;
  if (names?.[measure]) return names[measure];
  const column = /^\w+\((.*)\)$/.exec(measure)?.[1];
  return column || count;
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
  still = false,
  selected = null,
  onMark,
}: {
  /** Drawn for an image, where nothing may be moving when it is taken. */
  still?: boolean;
  /** The group of the mark clicked on this chart (#369), the others drawn faint. */
  selected?: string | null;
  /** A mark clicked, by its group; nothing is clickable without it. */
  onMark?: ((key: string) => void) | undefined;
  type: string;
  groups: Groups;
  measures: string[];
  options: Record<string, unknown>;
  locale: string;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  // A funnel reads from the largest stage down, whatever order the groups came in.
  const drawn = useMemo(
    () =>
      type === 'funnel'
        ? [...groups].sort((a, b) => Number(b.values[0] ?? 0) - Number(a.values[0] ?? 0))
        : groups,
    [type, groups],
  );
  const keys = drawn.map((group) => group.key ?? t('dashboards.none'));
  const clicked = useRef(onMark);
  clicked.current = onMark;
  const option = useMemo(() => {
    const colors = palette();
    const text = token('--text-soft');
    const border = token('--border');
    const format = (value: unknown) => formatValue(value, options, locale);
    const faint = (index: number) =>
      selected !== null && drawn[index]?.key !== selected ? { itemStyle: { opacity: 0.3 } } : {};
    const legend =
      options['legend'] !== false && (measures.length > 1 || type === 'pie' || type === 'donut');
    if (type === 'pie' || type === 'donut') {
      return {
        animation: !still,
        color: colors,
        tooltip: { trigger: 'item', valueFormatter: format },
        legend: legend ? { bottom: 0, textStyle: { color: text } } : undefined,
        series: [
          {
            type: 'pie',
            radius: type === 'donut' ? ['48%', '72%'] : '72%',
            center: ['50%', legend ? '44%' : '50%'],
            label: { show: options['labels'] !== false, color: text, formatter: '{b}: {d}%' },
            data: drawn.map((group, index) => ({
              name: keys[index],
              value: Number(group.values[0] ?? 0),
              ...faint(index),
            })),
          },
        ],
      };
    }
    if (type === 'funnel') {
      return {
        animation: !still,
        color: colors,
        tooltip: { trigger: 'item', valueFormatter: format },
        legend: options['legend'] === false ? undefined : { bottom: 0, textStyle: { color: text } },
        series: [
          {
            type: 'funnel',
            left: '8%',
            right: '8%',
            top: 8,
            bottom: options['legend'] === false ? 8 : 36,
            sort: 'none',
            label: { show: options['labels'] !== false, color: text },
            data: drawn.map((group, index) => ({
              name: keys[index],
              value: Number(group.values[0] ?? 0),
              ...faint(index),
            })),
          },
        ],
      };
    }
    if (type === 'treemap') {
      return {
        animation: !still,
        color: colors,
        tooltip: { valueFormatter: format },
        series: [
          {
            type: 'treemap',
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            label: {
              show: options['labels'] !== false,
              formatter: (mark: { name: string; value: number }) =>
                `${mark.name}\n${format(mark.value)}`,
            },
            data: drawn.map((group, index) => ({
              name: keys[index],
              value: Number(group.values[0] ?? 0),
              itemStyle: {
                color: colors[index % Math.max(1, colors.length)],
                ...(faint(index).itemStyle ?? {}),
              },
            })),
          },
        ],
      };
    }
    if (type === 'calendar') {
      const days = drawn.flatMap((group) => (group.key ? [group.key] : [])).sort();
      const values = drawn.map((group) => Number(group.values[0] ?? 0));
      return {
        animation: false,
        tooltip: {
          formatter: (mark: { value: [string, number] }) =>
            `${mark.value[0]}: ${format(mark.value[1])}`,
        },
        visualMap: {
          show: false,
          min: Math.min(...values),
          max: Math.max(...values),
          inRange: { color: [border, colors[0]] },
        },
        calendar: {
          range: [days[0], days[days.length - 1]],
          top: 28,
          left: 36,
          right: 8,
          bottom: 8,
          cellSize: ['auto', 'auto'],
          splitLine: { show: false },
          itemStyle: { borderColor: token('--surface'), color: 'transparent' },
          dayLabel: {
            color: text,
            firstDay: 1,
            nameMap: [0, 1, 2, 3, 4, 5, 6].map((day) =>
              new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(
                Date.UTC(2023, 0, 1 + day),
              ),
            ),
          },
          monthLabel: {
            color: text,
            nameMap: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((month) =>
              new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
                Date.UTC(2023, month, 1),
              ),
            ),
          },
          yearLabel: { show: false },
        },
        series: [
          {
            type: 'heatmap',
            coordinateSystem: 'calendar',
            data: drawn.map((group) => [group.key, Number(group.values[0] ?? 0)]),
          },
        ],
      };
    }
    if (type === 'waterfall') {
      // Each bar starts where the last ended, on an invisible bar under it.
      let running = 0;
      const steps = drawn.map((group) => {
        const value = Number(group.values[0] ?? 0);
        const from = running;
        running += value;
        return { value, base: Math.min(from, running) };
      });
      const closed = options['total'] === true;
      const names = closed ? [...keys, t('dashboards.total')] : keys;
      const barOf = (kept: (value: number) => boolean) => [
        ...steps.map((step, index) =>
          kept(step.value)
            ? { value: Math.abs(step.value), ...faint(index) }
            : { value: 0, itemStyle: { opacity: 0 } },
        ),
        ...(closed ? [{ value: 0, itemStyle: { opacity: 0 } }] : []),
      ];
      return {
        animation: !still,
        tooltip: {
          trigger: 'item',
          formatter: (mark: { dataIndex: number; name: string }) =>
            `${mark.name}: ${format(steps[mark.dataIndex]?.value ?? running)}`,
        },
        grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
        xAxis: {
          type: 'category',
          data: names,
          // Each step is a part of the sentence, so none of them is skipped.
          axisLabel: { color: text, interval: 0 },
          axisLine: { lineStyle: { color: border } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: text, formatter: (value: number) => format(value) },
          splitLine: { lineStyle: { color: border } },
        },
        series: [
          {
            type: 'bar',
            stack: 'flow',
            silent: true,
            itemStyle: { color: 'transparent' },
            data: [...steps.map((step) => step.base), ...(closed ? [0] : [])],
          },
          {
            type: 'bar',
            stack: 'flow',
            itemStyle: { color: colors[0] },
            label: {
              show: options['labels'] === true,
              color: text,
              formatter: (mark: { value: number }) => (mark.value ? format(mark.value) : ''),
            },
            data: barOf((value) => value >= 0),
          },
          {
            type: 'bar',
            stack: 'flow',
            itemStyle: { color: colors[1] },
            data: barOf((value) => value < 0),
          },
          ...(closed
            ? [
                {
                  type: 'bar',
                  stack: 'flow',
                  itemStyle: { color: colors[2] },
                  data: [...steps.map(() => 0), Math.max(running, 0)],
                },
              ]
            : []),
        ],
      };
    }
    const lines =
      type === 'combo'
        ? Array.isArray(options['lines'])
          ? (options['lines'] as string[])
          : measures.slice(-1)
        : [];
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
      // The lines of a combo measure something else, on an axis of their own.
      yAxis: horizontal
        ? category
        : type === 'combo'
          ? [
              values,
              {
                type: 'value',
                axisLabel: { color: text },
                splitLine: { show: false },
              },
            ]
          : values,
      series: measures.map((measure, index) => ({
        name: measureName(measure, options, t('dashboards.count')),
        type: type === 'bar' || (type === 'combo' && !lines.includes(measure)) ? 'bar' : 'line',
        ...(lines.includes(measure) ? { yAxisIndex: 1 } : {}),
        smooth: options['smooth'] === true,
        ...(type === 'area' ? { areaStyle: { opacity: 0.25 } } : {}),
        ...(stacked ? { stack: 'all' } : {}),
        label: { show: options['labels'] === true, color: text },
        data: groups.map((group, at) => {
          const value = Number(group.values[index] ?? 0);
          return {
            value: percent ? (totals[at] ? (value / (totals[at] as number)) * 100 : 0) : value,
            ...faint(at),
          };
        }),
      })),
    };
  }, [type, groups, drawn, measures, options, locale, keys, still, selected, t]);

  useEffect(() => {
    if (!host.current) return undefined;
    const chart = echarts.init(host.current, undefined, { renderer: 'svg' });
    chart.setOption(option as echarts.EChartsCoreOption);
    chart.on('click', (mark) => {
      const key = drawn[mark.dataIndex]?.key;
      if (key !== null && key !== undefined) clicked.current?.(key);
    });
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      chart.dispose();
    };
  }, [option, drawn]);

  if (groups.length === 0) return <p className="dash-empty">{t('dashboards.noRows')}</p>;
  return <div ref={host} className="dash-chart" role="img" aria-label={measures.join(', ')} />;
}

/** A chart that draws what it is given, with nothing to click. */
function Plot({ option, label }: { option: object; label: string }) {
  const host = useRef<HTMLDivElement>(null);
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
  return <div ref={host} className="dash-chart" role="img" aria-label={label} />;
}

/** A gauge (#370): one measure against its goal. */
export function Gauge({
  value,
  options,
  locale,
  still,
}: {
  value: unknown;
  options: Record<string, unknown>;
  locale: string;
  still: boolean;
}) {
  const { t } = useTranslation();
  const goal = Number(options['goal']);
  const reached = Number(value ?? 0);
  const option = useMemo(() => {
    const text = token('--text-soft');
    return {
      animation: !still,
      series: [
        {
          type: 'gauge',
          min: 0,
          max: goal,
          radius: '95%',
          center: ['50%', '62%'],
          startAngle: 200,
          endAngle: -20,
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          progress: { show: true, roundCap: true, width: 14, itemStyle: { color: palette()[0] } },
          axisLine: { roundCap: true, lineStyle: { width: 14, color: [[1, token('--track')]] } },
          detail: {
            valueAnimation: false,
            offsetCenter: [0, 0],
            fontSize: 22,
            color: token('--text'),
            formatter: () => formatValue(reached, options, locale),
          },
          title: { offsetCenter: [0, '38%'], color: text, fontSize: 12 },
          data: [
            {
              value: Math.min(reached, goal),
              name: t('dashboards.ofGoal', { goal: formatValue(goal, options, locale) }),
            },
          ],
        },
      ],
    };
  }, [goal, reached, options, locale, still, t]);
  return <Plot option={option} label={t('dashboards.ofGoal', { goal: String(goal) })} />;
}

/** A scatter (#370): a point per row, coloured by a column when the table has one. */
export function Scatter({
  rows,
  options,
  locale,
  still,
}: {
  rows: Rows;
  options: Record<string, unknown>;
  locale: string;
  still: boolean;
}) {
  const { t } = useTranslation();
  const option = useMemo(() => {
    const [x, y] = [String(options['x']), String(options['y'])];
    const text = token('--text-soft');
    const border = token('--border');
    const colorColumn = typeof options['color'] === 'string' ? options['color'] : null;
    const sizes = options['size']
      ? rows.map((row) => Number(row.values[String(options['size'])] ?? 0))
      : [];
    const largest = Math.max(1, ...sizes);
    const series = new Map<string, Array<{ name: string; value: number[] }>>();
    rows.forEach((row, index) => {
      const key = colorColumn ? String(row.values[colorColumn] ?? t('dashboards.none')) : '';
      const label = options['label'] ? String(row.values[String(options['label'])] ?? '') : '';
      const points = series.get(key) ?? [];
      points.push({
        name: label,
        value: [
          Number(row.values[x] ?? 0),
          Number(row.values[y] ?? 0),
          sizes[index] !== undefined ? 8 + ((sizes[index] as number) / largest) * 28 : 12,
        ],
      });
      series.set(key, points);
    });
    const axis = (name: string) => ({
      type: 'value',
      name,
      nameTextStyle: { color: text },
      axisLabel: {
        color: text,
        formatter: (value: number) => formatValue(value, options, locale),
      },
      splitLine: { lineStyle: { color: border } },
      scale: true,
    });
    return {
      animation: !still,
      color: palette(),
      tooltip: {
        formatter: (mark: { name: string; value: number[] }) =>
          `${mark.name ? `${mark.name}<br/>` : ''}${x}: ${formatValue(mark.value[0], options, locale)}<br/>${y}: ${formatValue(mark.value[1], options, locale)}`,
      },
      legend: colorColumn ? { bottom: 0, textStyle: { color: text } } : undefined,
      grid: { left: 8, right: 24, top: 24, bottom: colorColumn ? 36 : 8, containLabel: true },
      xAxis: axis(x),
      yAxis: axis(y),
      series: [...series].map(([name, data]) => ({
        name,
        type: 'scatter',
        data,
        symbolSize: (value: number[]) => value[2],
      })),
    };
  }, [rows, options, locale, still, t]);
  if (rows.length === 0) return <p className="dash-empty">{t('dashboards.noRows')}</p>;
  return <Plot option={option} label={`${String(options['x'])}, ${String(options['y'])}`} />;
}

/** A heatmap (#370): a matrix in colour, from what the matrix adds up. */
export function Heatmap({
  data,
  options,
  locale,
  still,
}: {
  data: {
    columns?: Array<string | null>;
    rows?: Array<{ key: string | null; cells: Array<number | string | null> }>;
  };
  options: Record<string, unknown>;
  locale: string;
  still: boolean;
}) {
  const { t } = useTranslation();
  const option = useMemo(() => {
    const text = token('--text-soft');
    const columns = (data.columns ?? []).map((column) => column ?? t('dashboards.none'));
    const rows = data.rows ?? [];
    const cells = rows.flatMap((row, y) =>
      row.cells.flatMap((cell, x) => (cell === null ? [] : [[x, y, Number(cell)]])),
    );
    const values = cells.map((cell) => cell[2] as number);
    return {
      animation: !still,
      tooltip: {
        formatter: (mark: { value: number[] }) =>
          `${rows[mark.value[1] as number]?.key ?? ''} · ${columns[mark.value[0] as number] ?? ''}: ${formatValue(mark.value[2], options, locale)}`,
      },
      grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: columns, axisLabel: { color: text } },
      yAxis: {
        type: 'category',
        data: rows.map((row) => row.key ?? t('dashboards.none')),
        axisLabel: { color: text },
      },
      visualMap: {
        show: false,
        min: Math.min(0, ...values),
        max: Math.max(1, ...values),
        inRange: { color: [token('--track'), palette()[0]] },
      },
      series: [{ type: 'heatmap', data: cells }],
    };
  }, [data, options, locale, still, t]);
  if ((data.rows ?? []).length === 0) return <p className="dash-empty">{t('dashboards.noRows')}</p>;
  return <Plot option={option} label={t('dashboards.total')} />;
}

/** A timeline (#370): the events of a table in the order they happen. */
export function Timeline({
  rows,
  options,
  locale,
}: {
  rows: Rows;
  options: Record<string, unknown>;
  locale: string;
}) {
  const { t } = useTranslation();
  const date = String(options['date']);
  const ordered = rows
    .filter((row) => typeof row.values[date] === 'string')
    .sort((a, b) => String(a.values[date]).localeCompare(String(b.values[date])));
  if (ordered.length === 0) return <p className="dash-empty">{t('dashboards.noRows')}</p>;
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  return (
    <ol className="dash-timeline">
      {ordered.map((row) => {
        const when = String(row.values[date]);
        const detail = options['detail'] ? row.values[String(options['detail'])] : undefined;
        const group = options['group'] ? row.values[String(options['group'])] : undefined;
        return (
          <li key={row.rowId} className="dash-timeline-item">
            <time dateTime={when}>
              {day.format(new Date(when.length === 10 ? `${when}T00:00:00Z` : when))}
            </time>
            <span className="dash-timeline-title">
              {String(row.values[String(options['title'])] ?? '')}
            </span>
            {group !== undefined ? <span className="dash-card-mark">{String(group)}</span> : null}
            {detail !== undefined ? (
              <span className="dash-card-detail">{String(detail)}</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
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

/** A WBS tree (#369): each row under its parent, its progress rolled up from its children. */
export function Wbs({ rows, options }: { rows: Rows; options: Record<string, unknown> }) {
  const { t } = useTranslation();
  const lines = wbsLines(wbsTree(rows, options));
  if (lines.length === 0) return <p className="dash-empty">{t('dashboards.noRows')}</p>;
  return (
    <ul className="dash-wbs">
      {lines.map((line) => (
        <li
          key={line.id}
          className={`dash-wbs-row${line.children.length > 0 ? ' is-parent' : ''}`}
          style={{ paddingLeft: `${line.depth * 1.25}rem` }}
        >
          <span className="dash-wbs-code">{line.code}</span>
          <span className="dash-wbs-title" title={line.title}>
            {line.title}
          </span>
          {line.progress !== null ? (
            <span className="dash-wbs-progress">
              <span className="dash-kpi-track">
                <span
                  className="dash-kpi-fill"
                  style={{ width: `${Math.max(0, Math.min(100, line.progress))}%` }}
                />
              </span>
              <span className="dash-wbs-percent">{Math.round(line.progress)}%</span>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** A matrix (#369): rows by columns, with what each row and column adds up to. */
export function Matrix({
  data,
  options,
  locale,
}: {
  data: {
    columns?: Array<string | null>;
    rows?: Array<{
      key: string | null;
      cells: Array<number | string | null>;
      total: number | string | null;
    }>;
    totals?: Array<number | string | null>;
    grand?: number | string | null;
  };
  options: Record<string, unknown>;
  locale: string;
}) {
  const { t } = useTranslation();
  const columns = data.columns ?? [];
  const rows = data.rows ?? [];
  const totals = options['totals'] !== false;
  const value = (cell: unknown) => formatValue(cell, options, locale);
  if (rows.length === 0) return <p className="dash-empty">{t('dashboards.noRows')}</p>;
  return (
    <div className="data-table-scroll">
      <table className="data-table dash-matrix">
        <thead>
          <tr>
            <th scope="col" />
            {columns.map((column) => (
              <th key={column ?? ''} scope="col" className="is-numeric">
                {column ?? t('dashboards.none')}
              </th>
            ))}
            {totals ? (
              <th scope="col" className="is-numeric">
                {t('dashboards.total')}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key ?? ''}>
              <th scope="row">{row.key ?? t('dashboards.none')}</th>
              {row.cells.map((cell, index) => (
                <td key={columns[index] ?? ''} className="is-numeric">
                  {value(cell)}
                </td>
              ))}
              {totals ? <td className="is-numeric is-total">{value(row.total)}</td> : null}
            </tr>
          ))}
        </tbody>
        {totals ? (
          <tfoot>
            <tr>
              <th scope="row">{t('dashboards.total')}</th>
              {(data.totals ?? []).map((cell, index) => (
                <td key={columns[index] ?? ''} className="is-numeric is-total">
                  {value(cell)}
                </td>
              ))}
              <td className="is-numeric is-total">{value(data.grand)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
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
