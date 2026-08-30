import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getVaultStructure } from '../../shared/api/source';
import type { VaultStructure } from '../../shared/types/api';
import { BrandMark } from '../../shared/components/BrandMark';
import { GraphIcon, MenuIcon, PanelLeftCloseIcon } from '../../shared/components/icons';
import { SearchBox } from '../search/SearchBox';
import { ExportVaultButton } from '../portability/ExportVaultButton';
import { FolderTree } from './FolderTree';

export interface VaultOutletContext {
  structure: VaultStructure;
}

export function VaultLayout() {
  const { t } = useTranslation();
  const { vaultSlug = '' } = useParams();
  const { pathname } = useLocation();
  /**
   * The sidebar is a permanent column on a wide screen and a drawer on a narrow
   * one. Only the narrow case needs state, and the CSS decides which case is
   * live: below the breakpoint the aside is off canvas until this flag opens it,
   * above it the flag is inert and the column is simply there.
   */
  const [navOpen, setNavOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // A drawer that survives navigation would cover the page the person just
  // asked for, which on a phone is the whole screen.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    // While the drawer is up it is the only thing that scrolls.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [navOpen]);

  const { data, isPending, isError } = useQuery({
    queryKey: ['vault-structure', vaultSlug],
    queryFn: () => getVaultStructure(vaultSlug),
  });

  if (isPending) return <p className="status">{t('common.loading')}</p>;
  if (isError || !data) return <p className="status">{t('common.notFound')}</p>;

  return (
    <div className={`vault-layout${navOpen ? ' nav-open' : ''}`}>
      {/* Shown by CSS only where the sidebar is a drawer. */}
      <button
        type="button"
        className="vault-nav-toggle"
        aria-label={t('structure.openNavigation')}
        aria-expanded={navOpen}
        aria-controls="vault-sidebar"
        onClick={() => setNavOpen(true)}
      >
        <MenuIcon />
        <span>{data.vault.name}</span>
      </button>
      <div
        className="vault-nav-scrim"
        hidden={!navOpen}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />
      <aside className="vault-sidebar" id="vault-sidebar">
        {/* The drawer covers the app header, so it carries the brand itself.
            Shown by CSS only where the sidebar is a drawer. */}
        <div className="vault-nav-head">
          <span className="brand">
            <BrandMark />
          </span>
          <button
            type="button"
            className="vault-nav-close"
            aria-label={t('structure.closeNavigation')}
            ref={closeRef}
            onClick={() => setNavOpen(false)}
          >
            <PanelLeftCloseIcon />
          </button>
        </div>
        <Link to="/" className="back-link">
          ← {t('structure.backToVaults')}
        </Link>
        <Link
          to={`/vaults/${vaultSlug}`}
          className="vault-title-link"
          title={t('structure.heading')}
        >
          <h2>{data.vault.name}</h2>
        </Link>
        <SearchBox vaultSlug={vaultSlug} structure={data} />
        <nav className="vault-nav">
          <NavLink to={`/vaults/${vaultSlug}/graph`} className="vault-nav-link">
            <GraphIcon /> {t('graph.navLabel')}
          </NavLink>
          <ExportVaultButton vaultSlug={vaultSlug} />
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
