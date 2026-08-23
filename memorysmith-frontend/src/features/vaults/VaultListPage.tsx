import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listVaults } from '../../shared/api/client';

export function VaultListPage() {
  const { t } = useTranslation();
  const { data, isPending } = useQuery({ queryKey: ['vaults'], queryFn: listVaults });

  if (isPending) return <p className="status">{t('common.loading')}</p>;

  return (
    <section className="page">
      <h1>{t('vaults.heading')}</h1>
      <div className="vault-grid">
        {data?.map((vault) => (
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
