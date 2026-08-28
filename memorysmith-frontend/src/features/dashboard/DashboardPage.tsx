import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listVaults } from '../../shared/api/source';
import { LiveDashboard } from './LiveDashboard';
import { CardCarousel } from '../../shared/components/CardCarousel';

/**
 * The vault catalogue, and under it what the vaults themselves declare. There
 * used to be a second overview here, charting a fixed set of frontmatter
 * attributes that only the bundled seed guaranteed; the product never imposed
 * that convention, and the seed is gone (live-stats.ts).
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const { data: vaults } = useQuery({ queryKey: ['vaults'], queryFn: listVaults });

  return (
    <section className="page dashboard">
      <h2 className="dashboard-section-heading">{t('dashboard.selectVault')}</h2>
      <CardCarousel prevLabel={t('dashboard.prevVaults')} nextLabel={t('dashboard.nextVaults')}>
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
      </CardCarousel>

      <LiveDashboard />
    </section>
  );
}
