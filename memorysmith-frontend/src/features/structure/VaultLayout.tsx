import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getVaultStructure } from '../../shared/api/client';
import type { VaultStructure } from '../../shared/types/api';
import { GraphIcon } from '../../shared/components/icons';
import { SearchBox } from '../search/SearchBox';
import { FolderTree } from './FolderTree';

export interface VaultOutletContext {
  structure: VaultStructure;
}

export function VaultLayout() {
  const { t } = useTranslation();
  const { vaultSlug = '' } = useParams();
  const { data, isPending, isError } = useQuery({
    queryKey: ['vault-structure', vaultSlug],
    queryFn: () => getVaultStructure(vaultSlug),
  });

  if (isPending) return <p className="status">{t('common.loading')}</p>;
  if (isError || !data) return <p className="status">{t('common.notFound')}</p>;

  return (
    <div className="vault-layout">
      <aside className="vault-sidebar">
        <Link to="/" className="back-link">← {t('structure.backToVaults')}</Link>
        <Link to={`/vaults/${vaultSlug}`} className="vault-title-link">
          <h2>{data.vault.name}</h2>
        </Link>
        <SearchBox vaultSlug={vaultSlug} structure={data} />
        <NavLink to={`/vaults/${vaultSlug}/graph`} className="graph-nav-link">
          <GraphIcon /> {t('graph.navLabel')}
        </NavLink>
        <p className="sidebar-caption">{t('structure.folders')}</p>
        <FolderTree vaultSlug={vaultSlug} folders={data.folders} />
      </aside>
      <section className="vault-content">
        <Outlet context={{ structure: data } satisfies VaultOutletContext} />
      </section>
    </div>
  );
}
