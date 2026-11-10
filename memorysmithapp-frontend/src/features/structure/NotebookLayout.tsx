import { useEffect } from 'react';
import { useLiveInterval } from '../../shared/api/live';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNotebookFiles, getNotebookNames, getNotebookStructure } from '../../shared/api/source';
import type { NotebookStructure } from '../../shared/types/api';
import { NotebookIdProvider } from '../../shared/components/notebook-id';
import { NARROW_NOTEBOOK, useMatchMedia } from '../../shared/lib/media';
import { MobileMenuNotebook } from '../../shared/components/MobileMenu';
import { NotebookNav } from './NotebookNav';
import { FolderTree } from './FolderTree';
import { FolderTreeSkeleton, NoteSkeleton } from '../../shared/components/skeletons';
import { SkeletonBar } from '../../shared/components/Skeleton';
import { queryState } from '../../shared/api/query-state';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { useNotebookId } from './route-ids';
import { queryKeys } from '../../shared/api/query-keys';
import { flushEverySession, useEditSessions } from '../../shared/store/edit-sessions';
import { usePreferences } from '../../shared/store/preferences';
import { SidebarFold } from '../../shared/components/SidebarFold';

export interface NotebookOutletContext {
  structure: NotebookStructure;
}

export function NotebookLayout() {
  const { t } = useTranslation();
  // The identifier read straight from the path: there is no listing to search
  // for it any more, and a segment that is not one answers not-found without a
  // request (RN-DSC-045).
  const notebookId = useNotebookId();
  /**
   * A permanent column on a wide screen, and a part of the menu of the ☰ on a
   * narrow one (#419). Only one of them is ever mounted, so the tree and the
   * search box are never in the page twice.
   */
  const narrow = useMatchMedia(NARROW_NOTEBOOK);
  // Folded to its icons, by the same choice as the shell's sidebar (#414).
  const collapsed = usePreferences((s) => s.sidebarCollapsed);

  const query = useQuery({
    queryKey: queryKeys.notebookStructure(notebookId),
    refetchInterval: useLiveInterval(),
    queryFn: () => getNotebookStructure(notebookId),
    enabled: notebookId !== '',
  });
  const { data } = query;

  /**
   * What the notebook answers to besides the names the tree carries: the
   * spellings each note declares, which are read by Discovery and by nothing
   * else (INV-05). A link is drawn by what it REACHES, and without this a
   * target an alias answers was drawn as a target that reaches nothing (#164).
   *
   * It runs beside the structure and never in front of it: nothing on the
   * page waits for it.
   */
  useQuery({
    queryKey: queryKeys.notebookNames(notebookId),
    refetchInterval: useLiveInterval(),
    queryFn: () => getNotebookNames(notebookId),
    enabled: notebookId !== '',
  });

  /**
   * And what it keeps beside its notes (#166): a note reaches a file with
   * `![[name]]`, and what a target IS cannot be read off the name — the
   * extension decides nothing — so the page reads the files the way it reads
   * the names.
   */
  useQuery({
    queryKey: queryKeys.notebookFiles(notebookId),
    refetchInterval: useLiveInterval(),
    queryFn: () => getNotebookFiles(notebookId),
    enabled: notebookId !== '',
  });

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
    <NotebookIdProvider notebookId={notebookId}>
      <LeaveGuard />
      <div className="notebook-layout">
        {narrow ? (
          <MobileMenuNotebook>
            {/* The notebook in the menu of the ☰ (#419), in groups: its name, its
                Context and its pages, and its content as the tree. Its notes
                are searched from the search at the top of the menu (#418). */}
            <section className="mobile-menu-group" aria-label={data?.notebook.name}>
              <div className="sidebar-head">
                <h2 className="sidebar-notebook">
                  {data ? data.notebook.name : <SkeletonBar width="10rem" height="1.4rem" />}
                </h2>
              </div>
              <NotebookNav notebookId={notebookId} />
              <hr className="sidebar-rule" />
              <p className="sidebar-caption">{t('structure.content')}</p>
              {data ? (
                <FolderTree notebookId={notebookId} folders={data.folders} />
              ) : (
                <FolderTreeSkeleton />
              )}
            </section>
          </MobileMenuNotebook>
        ) : (
          <>
            <aside
              className={`notebook-sidebar${collapsed ? ' is-collapsed' : ''}`}
              id="notebook-sidebar"
            >
              <div className="sidebar-head">
                {/* The way to the Context is its own entry below and the first
                    crumb of the bar, so the name is only the name (#228); the
                    way back to Notebooks and Models is the menu of the product,
                    above, and only it (#422). */}
                <h2 className="sidebar-notebook">
                  {data ? data.notebook.name : <SkeletonBar width="10rem" height="1.4rem" />}
                </h2>
              </div>
              <NotebookNav notebookId={notebookId} />
              <div className="sidebar-content">
                <hr className="sidebar-rule" />
                <p className="sidebar-caption">{t('structure.content')}</p>
                {data ? (
                  <FolderTree notebookId={notebookId} folders={data.folders} />
                ) : (
                  <FolderTreeSkeleton />
                )}
              </div>
              <SidebarFold />
            </aside>
          </>
        )}
        <section className="notebook-content">
          {data ? (
            <Outlet context={{ structure: data } satisfies NotebookOutletContext} />
          ) : (
            <NoteSkeleton />
          )}
        </section>
      </div>
    </NotebookIdProvider>
  );
}

/**
 * Leaving a notebook page with a save of an editor waiting (#300, #301): a
 * link inside the product never reaches `beforeunload`, so the router asks —
 * once, for every session of the screen, because a router holds one blocker.
 */
function LeaveGuard() {
  const { t } = useTranslation();
  const waiting = useEditSessions((state) => state.waiting.size > 0);
  const blocker = useBlocker(waiting);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(t('editor.leaveWarning'))) {
      void flushEverySession();
      blocker.proceed();
    } else blocker.reset();
  }, [blocker, t]);
  return null;
}
