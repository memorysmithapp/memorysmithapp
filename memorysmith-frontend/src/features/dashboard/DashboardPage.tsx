import { useQuery } from '@tanstack/react-query';
import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listVaults } from '../../shared/api/client';
import { MATURITY_ORDER, maturityOf, topTypes, totals, vaultStats, type Maturity } from '../../shared/api/stats';

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

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: vaults } = useQuery({ queryKey: ['vaults'], queryFn: listVaults });
  const tooltip = useTooltip();

  const kpis = totals();
  const types = topTypes(8);
  const maxType = Math.max(...types.map((entry) => entry.count));

  return (
    <section className="page dashboard">
      {tooltip.node}
      <h1>{t('dashboard.heading')}</h1>

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
      </div>

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
    </section>
  );
}
