import { useQuery } from '@tanstack/react-query';
import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listVaults } from '../../shared/api/client';
import {
  MATURITY_ORDER,
  createdTimeline,
  distinctTagCount,
  maturityOf,
  topTags,
  topTypes,
  totals,
  vaultStats,
  type Maturity,
} from '../../shared/api/stats';

interface TooltipState {
  x: number;
  y: number;
  text: string;
}

function useTooltip() {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const show = (event: MouseEvent, text: string) =>
    setTip({ x: event.clientX + 12, y: event.clientY + 12, text });
  const hide = () => setTip(null);
  const node = tip ? (
    <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>
  ) : null;
  return { show, hide, node };
}

const nf = new Intl.NumberFormat();
const df = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit' });

const formatDay = (iso: string) => df.format(new Date(`${iso}T00:00:00`));

// Stacked column area height in px; segments scale against the busiest day.
const TIMELINE_HEIGHT = 150;

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: vaults } = useQuery({ queryKey: ['vaults'], queryFn: listVaults });
  const tooltip = useTooltip();

  const kpis = totals();
  const reviewedPct = kpis.notes > 0 ? Math.round((kpis.reviewed / kpis.notes) * 100) : 0;
  const types = topTypes(8);
  const maxType = Math.max(...types.map((entry) => entry.count));
  const tags = topTags(10);
  const maxTag = Math.max(...tags.map((entry) => entry.count));
  const timeline = createdTimeline();

  return (
    <section className="page dashboard">
      {tooltip.node}
      <h1>{t('dashboard.heading')}</h1>

      <h2 className="dashboard-select-heading">{t('dashboard.selectVault')}</h2>
      <div className="vault-grid">
        {vaults?.map((vault) => (
          <Link key={vault.id} to={`/vaults/${vault.slug}`} className="vault-card">
            <h2>{vault.name}</h2>
            <p>{vault.description}</p>
            <footer>
              <span>{t('vaults.noteCount', { count: vault.noteCount })}</span>
              <span className="vault-open">{t('vaults.open')} →</span>
            </footer>
          </Link>
        ))}
      </div>


      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">{nf.format(kpis.vaults)}</span>
          <span className="stat-label">{t('dashboard.kpiVaults')}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{nf.format(kpis.notes)}</span>
          <span className="stat-label">{t('dashboard.kpiNotes')}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{nf.format(kpis.reviewed)}</span>
          <span className="stat-label">{t('dashboard.kpiReviewed', { pct: reviewedPct })}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{nf.format(kpis.resolvedLinks)}</span>
          <span className="stat-label">{t('dashboard.kpiResolved')}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{nf.format(kpis.pendingLinks)}</span>
          <span className="stat-label">{t('dashboard.kpiPending')}</span>
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-card">
          <h2>{t('dashboard.maturityHeading')}</h2>
          <div className="chart-legend">
            {MATURITY_ORDER.map((bucket) => (
              <span key={bucket} className="legend-item">
                <span className={`legend-swatch seq-${bucket}`} />
                {t(`dashboard.bucket.${bucket}`)}
              </span>
            ))}
          </div>
          {vaultStats.map((vault) => {
            const buckets = maturityOf(vault);
            return (
              <div key={vault.vault} className="hbar-row">
                <span className="hbar-label">{vault.name}</span>
                <div className="hbar-track">
                  {MATURITY_ORDER.map((bucket: Maturity) => {
                    const count = buckets[bucket];
                    if (count === 0) return null;
                    const pct = (count / vault.notes) * 100;
                    return (
                      <div
                        key={bucket}
                        className={`hbar-seg seq-${bucket}`}
                        style={{ width: `${pct}%` }}
                        onMouseMove={(e) =>
                          tooltip.show(e, `${t(`dashboard.bucket.${bucket}`)}: ${nf.format(count)} (${Math.round(pct)}%)`)
                        }
                        onMouseLeave={tooltip.hide}
                      >
                        {pct >= 12 && <span className="hbar-seg-label">{nf.format(count)}</span>}
                      </div>
                    );
                  })}
                </div>
                <span className="hbar-total">{nf.format(vault.notes)}</span>
              </div>
            );
          })}
        </div>

        <div className="chart-card">
          <h2>{t('dashboard.reviewedHeading')}</h2>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-swatch seq-evergreen" />
              {t('dashboard.reviewedYes')}
            </span>
            <span className="legend-item">
              <span className="legend-swatch seq-seed" />
              {t('dashboard.reviewedNo')}
            </span>
          </div>
          {vaultStats.map((vault) => {
            const segments = [
              { key: 'yes', className: 'seq-evergreen', label: t('dashboard.reviewedYes'), count: vault.reviewed },
              { key: 'no', className: 'seq-seed', label: t('dashboard.reviewedNo'), count: vault.notes - vault.reviewed },
            ];
            return (
              <div key={vault.vault} className="hbar-row">
                <span className="hbar-label">{vault.name}</span>
                <div className="hbar-track">
                  {segments.map((segment) => {
                    if (segment.count === 0) return null;
                    const pct = (segment.count / vault.notes) * 100;
                    return (
                      <div
                        key={segment.key}
                        className={`hbar-seg ${segment.className}`}
                        style={{ width: `${pct}%` }}
                        onMouseMove={(e) =>
                          tooltip.show(e, `${segment.label}: ${nf.format(segment.count)} (${Math.round(pct)}%)`)
                        }
                        onMouseLeave={tooltip.hide}
                      >
                        {pct >= 12 && <span className="hbar-seg-label">{nf.format(segment.count)}</span>}
                      </div>
                    );
                  })}
                </div>
                <span className="hbar-total">{nf.format(vault.notes)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-card">
          <h2>{t('dashboard.typesHeading')}</h2>
          <div className="barlist">
            {types.map((entry) => (
              <div key={entry.type} className="barlist-row">
                <span className="barlist-label">
                  {entry.type === '__other__' ? t('dashboard.otherTypes') : entry.type}
                </span>
                <div className="barlist-track">
                  <div
                    className="barlist-bar"
                    style={{ width: `${(entry.count / maxType) * 100}%` }}
                    onMouseMove={(e) => tooltip.show(e, `${nf.format(entry.count)}`)}
                    onMouseLeave={tooltip.hide}
                  />
                </div>
                <span className="barlist-value">{nf.format(entry.count)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h2>{t('dashboard.tagsHeading')}</h2>
          <div className="barlist">
            {tags.map((entry) => (
              <div key={entry.tag} className="barlist-row">
                <span className="barlist-label">{entry.tag}</span>
                <div className="barlist-track">
                  <div
                    className="barlist-bar"
                    style={{ width: `${(entry.count / maxTag) * 100}%` }}
                    onMouseMove={(e) => tooltip.show(e, `${nf.format(entry.count)}`)}
                    onMouseLeave={tooltip.hide}
                  />
                </div>
                <span className="barlist-value">{nf.format(entry.count)}</span>
              </div>
            ))}
          </div>
          <p className="chart-footnote">{t('dashboard.tagsDistinct', { count: distinctTagCount() })}</p>
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-card chart-card-wide">
          <h2>{t('dashboard.timelineHeading')}</h2>
          <div className="chart-legend">
            {timeline.series.map((series, index) => (
              <span key={series.vault} className="legend-item">
                <span className={`legend-swatch cat-${index + 1}`} />
                {series.name}
              </span>
            ))}
          </div>
          <div className="colchart" style={{ height: `${TIMELINE_HEIGHT}px` }}>
            {timeline.days.map((day, dayIndex) => {
              const total = timeline.series.reduce((sum, s) => sum + (s.counts[dayIndex] ?? 0), 0);
              return (
                <div key={day} className="colchart-col">
                  {total >= timeline.maxTotal * 0.3 && (
                    <span className="colchart-col-label">{nf.format(total)}</span>
                  )}
                  <div className="colchart-stack">
                    {[...timeline.series]
                      .map((series, index) => ({ series, index }))
                      .reverse()
                      .map(({ series, index }) => {
                        const count = series.counts[dayIndex] ?? 0;
                        if (count === 0) return null;
                        const height = Math.max((count / timeline.maxTotal) * TIMELINE_HEIGHT, 2);
                        return (
                          <div
                            key={series.vault}
                            className={`colchart-seg cat-${index + 1}`}
                            style={{ height: `${height}px` }}
                            onMouseMove={(e) =>
                              tooltip.show(e, `${formatDay(day)} · ${series.name}: ${nf.format(count)}`)
                            }
                            onMouseLeave={tooltip.hide}
                          />
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="colchart-axis">
            {timeline.days.map((day, index) => (
              <span key={day} className="colchart-tick">
                {index % 7 === 0 ? formatDay(day) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
