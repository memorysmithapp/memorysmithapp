import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getVaultStructure } from '../../shared/api/client';
import type { VaultStructure } from '../../shared/types/api';
import { GraphIcon, StructureIcon } from '../../shared/components/icons';
import { SearchBox } from '../search/SearchBox';
import { FolderTree } from './FolderTree';

export interface VaultOutletContext {
  structure: VaultStructure;
}

export function VaultLayout() {
  const { t } = useTranslation();
  const { vaultSlug = '' } = useParams();
  const { pathname } = useLocation();
  // Guidance and Templates are facets of the structure; keep its entry lit there.
  const structureActive = /\/(guidance|templates)$/.test(pathname);
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
        <nav className="vault-nav">
          <NavLink
            to={`/vaults/${vaultSlug}`}
            end
            className={({ isActive }) => `vault-nav-link${isActive || structureActive ? ' active' : ''}`}
          >
            <StructureIcon /> {t('structure.heading')}
          </NavLink>
          <NavLink to={`/vaults/${vaultSlug}/graph`} className="vault-nav-link">
            <GraphIcon /> {t('graph.navLabel')}
          </NavLink>
        </nav>
        <p className="sidebar-caption">{t('structure.content')}</p>
        <FolderTree vaultSlug={vaultSlug} folders={data.folders} />
      </aside>
      <section className="vault-content">
        <Outlet context={{ structure: data } satisfies VaultOutletContext} />
      </section>
    </div>
  );
}
