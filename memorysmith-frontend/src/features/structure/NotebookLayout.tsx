import { useLiveInterval } from '../../shared/api/live';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNotebookFiles, getNotebookNames, getNotebookStructure } from '../../shared/api/source';
import type { NotebookStructure } from '../../shared/types/api';
import { NotebookIdProvider } from '../../shared/components/notebook-id';
import { ArrowLeftIcon } from '../../shared/components/icons';
import { NARROW_NOTEBOOK, useMatchMedia } from '../../shared/lib/media';
import { NotebookSheet } from './NotebookSheet';
import { NotebookNav } from './NotebookNav';
import { SearchBox } from '../search/SearchBox';
import { FolderTree } from './FolderTree';
import { FolderTreeSkeleton, NoteSkeleton } from '../../shared/components/skeletons';
import { SkeletonBar } from '../../shared/components/Skeleton';
import { queryState } from '../../shared/api/query-state';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { useNotebookId } from './route-ids';
import { queryKeys } from '../../shared/api/query-keys';

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
   * A permanent column on a wide screen, and the sheet at the foot of the
   * screen on a narrow one (#229). Only one of them is ever mounted, so the
   * tree and the search box are never in the page twice.
   */
  const narrow = useMatchMedia(NARROW_NOTEBOOK);

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
   * else (rule 5). A link is drawn by what it REACHES, and without this a
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
      <div className="notebook-layout">
        {narrow ? (
          <NotebookSheet notebookId={notebookId} structure={data} />
        ) : (
          <aside className="notebook-sidebar" id="notebook-sidebar">
            <div className="sidebar-head">
              <Link to="/" className="back-link">
                <ArrowLeftIcon width={14} height={14} />
                {t('structure.backToNotebooks')}
              </Link>
              {/* The way to the Context is its own entry below and the first
                  crumb of the bar, so the name is only the name (#228). */}
              <h2 className="sidebar-notebook">
                {data ? data.notebook.name : <SkeletonBar width="10rem" height="1.4rem" />}
              </h2>
            </div>
            {data ? (
              <SearchBox notebookId={notebookId} structure={data} />
            ) : (
              <SkeletonBar height="2.2rem" />
            )}
            <NotebookNav notebookId={notebookId} />
            <hr className="sidebar-rule" />
            <p className="sidebar-caption">{t('structure.content')}</p>
            {data ? (
              <FolderTree notebookId={notebookId} folders={data.folders} />
            ) : (
              <FolderTreeSkeleton />
            )}
          </aside>
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
