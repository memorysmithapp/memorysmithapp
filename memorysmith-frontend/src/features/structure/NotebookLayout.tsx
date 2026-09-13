import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNotebookStructure } from '../../shared/api/source';
import { graphAddress, notebookAddress } from '../../shared/api/note-address';
import type { NotebookStructure } from '../../shared/types/api';
import { BrandMark } from '../../shared/components/BrandMark';
import { GraphIcon, MenuIcon, PanelLeftCloseIcon } from '../../shared/components/icons';
import { SearchBox } from '../search/SearchBox';
import { ExportNotebookButton } from '../portability/ExportNotebookButton';
import { FolderTree } from './FolderTree';
import { FolderTreeSkeleton, NoteSkeleton } from '../../shared/components/skeletons';
import { SkeletonBar } from '../../shared/components/Skeleton';
import { queryState } from '../../shared/api/query-state';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { useNotebookId } from './route-ids';

export interface NotebookOutletContext {
  structure: NotebookStructure;
}

export function NotebookLayout() {
  const { t } = useTranslation();
  // The identifier read straight from the path: there is no listing to search
  // for it any more, and a segment that is not one answers not-found without a
  // request (RN-DSC-045).
  const notebookId = useNotebookId();
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

  const query = useQuery({
    queryKey: ['notebook-structure', notebookId],
    queryFn: () => getNotebookStructure(notebookId),
    enabled: notebookId !== '',
  });
  const { data } = query;

  if (!notebookId) return <p className="status">{t('common.notFound')}</p>;
  if (queryState(query) === 'error') {
    return <p className="status">{t(messageKeyOf(query.error))}</p>;
  }

  /**
   * The frame of this screen is known before the request leaves, so it is
   * drawn immediately and never withheld: the sidebar, the brand, the search
   * box, the navigation and the content column are all here from the first
   * paint, and only the parts the query fills are placeholders. Withholding
   * the whole layout for a structure query was the largest single wait in the
   * product, and it made the frame arrive with a jump every time.
   */

  return (
    <div className={`notebook-layout${navOpen ? ' nav-open' : ''}`}>
      {/* Shown by CSS only where the sidebar is a drawer. */}
      <button
        type="button"
        className="notebook-nav-toggle"
        aria-label={t('structure.openNavigation')}
        aria-expanded={navOpen}
        aria-controls="notebook-sidebar"
        onClick={() => setNavOpen(true)}
      >
        <MenuIcon />
        <span>{data ? data.notebook.name : <SkeletonBar width="8rem" height="1rem" />}</span>
      </button>
      <div
        className="notebook-nav-scrim"
        hidden={!navOpen}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />
      <aside className="notebook-sidebar" id="notebook-sidebar">
        {/* The drawer covers the app header, so it carries the brand itself.
            Shown by CSS only where the sidebar is a drawer. */}
        <div className="notebook-nav-head">
          <span className="brand">
            <BrandMark />
          </span>
          <button
            type="button"
            className="notebook-nav-close"
            aria-label={t('structure.closeNavigation')}
            ref={closeRef}
            onClick={() => setNavOpen(false)}
          >
            <PanelLeftCloseIcon />
          </button>
        </div>
        <Link to="/" className="back-link">
          ← {t('structure.backToNotebooks')}
        </Link>
        <Link
          to={notebookAddress(notebookId)}
          className="notebook-title-link"
          title={t('structure.heading')}
        >
          <h2>{data ? data.notebook.name : <SkeletonBar width="10rem" height="1.4rem" />}</h2>
        </Link>
        {data ? (
          <SearchBox notebookId={notebookId} structure={data} />
        ) : (
          <SkeletonBar height="2.2rem" />
        )}
        <nav className="notebook-nav">
          <NavLink to={graphAddress(notebookId)} className="notebook-nav-link">
            <GraphIcon /> {t('graph.navLabel')}
          </NavLink>
          <ExportNotebookButton notebookId={notebookId} />
        </nav>
        <p className="sidebar-caption">{t('structure.content')}</p>
        {data ? (
          <FolderTree notebookId={notebookId} folders={data.folders} />
        ) : (
          <FolderTreeSkeleton />
        )}
      </aside>
      <section className="notebook-content">
        {data ? (
          <Outlet context={{ structure: data } satisfies NotebookOutletContext} />
        ) : (
          <NoteSkeleton />
        )}
      </section>
    </div>
  );
}
