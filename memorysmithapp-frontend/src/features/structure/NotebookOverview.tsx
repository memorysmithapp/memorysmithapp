import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/intl-locale';
import {
  attachmentsAddress,
  dashboardsAddress,
  foldersAddress,
  linkTargetAddress,
  noteAddress,
  tablesAddress,
} from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import {
  getNotebookFiles,
  getNotebookHealth,
  listDashboards,
  listTables,
} from '../../shared/api/source';
import { useLiveInterval } from '../../shared/api/live';
import { useLiveSession } from '../../shared/auth/session';
import { useDocumentTitle } from '../../shared/components/document-title';
import { HistoryIcon } from '../../shared/components/icons';
import { SkeletonBar } from '../../shared/components/Skeleton';
import { lastNoteOf } from '../../shared/store/last-note';
import type { FolderNode, NoteSummary } from '../../shared/types/api';
import { formatDay } from '../dashboard/NotebookCard';
import { NotebookBar } from './NotebookBreadcrumb';
import type { NotebookOutletContext } from './NotebookLayout';
import { authorLabel, byAgent } from './note-author';
import { useNotebookId } from './route-ids';

/** How many notes "Changed lately" lists, and how many of each kind of loose end. */
const LATELY = 8;
const LOOSE_ENDS = 10;
/** A number that could not be read: said as unknown, never as zero. */
const UNREAD = '–';

/** Every note of the notebook, each with the name of its folder. */
function notesOf(folders: FolderNode[]): Array<{ note: NoteSummary; folder: string }> {
  return folders.flatMap((folder) => [
    ...folder.notes.map((note) => ({ note, folder: folder.name })),
    ...notesOf(folder.children),
  ]);
}

function countFolders(folders: FolderNode[]): number {
  return folders.reduce((total, folder) => total + 1 + countFolders(folder.children), 0);
}

/**
 * What a notebook is, on one screen, where it used to jump to the note last
 * read (#417): the way back to that note first, then how many notes, folders
 * and tables it holds and how many of its links wait for a note or lead
 * nowhere, then what changed last. The Notebook Context is a page of its own.
 */
export function NotebookOverview() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const notebookId = useNotebookId();
  const me = useLiveSession((s) => s.session?.userId ?? '');
  const { structure } = useOutletContext<NotebookOutletContext>();
  useDocumentTitle(structure.notebook.name);
  const live = useLiveInterval();

  const health = useQuery({
    queryKey: queryKeys.notebookHealth(notebookId),
    queryFn: () => getNotebookHealth(notebookId),
    refetchInterval: live,
  });
  const tables = useQuery({
    queryKey: queryKeys.notebookTables(notebookId),
    queryFn: () => listTables(notebookId),
    refetchInterval: live,
  });
  // The same reads as the pages the numbers lead to, so each says what its page shows.
  const files = useQuery({
    queryKey: queryKeys.notebookFiles(notebookId),
    queryFn: () => getNotebookFiles(notebookId),
    refetchInterval: live,
  });
  const dashboards = useQuery({
    queryKey: queryKeys.notebookDashboards(notebookId),
    queryFn: () => listDashboards(notebookId),
    refetchInterval: live,
  });
  const count = (query: { isError: boolean; data?: readonly unknown[] }) =>
    query.isError ? UNREAD : query.data?.length;

  const notes = useMemo(() => notesOf(structure.folders), [structure.folders]);
  const lately = useMemo(
    () =>
      [...notes].sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt)).slice(0, LATELY),
    [notes],
  );
  // The note this person read last here, while it is still a note of it.
  const lastId = lastNoteOf(me, notebookId);
  const last = lastId ? notes.find(({ note }) => note.id === lastId) : undefined;

  const folderCount = countFolders(structure.folders);
  const pending = health.data?.pendingLinks ?? [];
  const orphans = health.data?.orphans ?? [];

  return (
    <>
      <NotebookBar crumbs={[{ label: t('overview.title') }]} />
      <article className="content-pane overview-page">
        {last ? (
          <Link to={noteAddress(notebookId, last.note.id)} className="overview-resume">
            <span className="overview-resume-icon">
              <HistoryIcon />
            </span>
            <span className="overview-resume-text">
              <span className="overview-resume-label">{t('overview.resume')}</span>
              <span className="overview-resume-name">{last.note.name ?? t('note.unnamed')}</span>
              <span className="overview-resume-folder">{last.folder}</span>
            </span>
          </Link>
        ) : null}

        {/* Seven cards of one size, four to a row, in the order of the sidebar:
            what the notebook holds, then what asks for attention (#423). */}
        <ul className="overview-stats" aria-label={t('overview.stats')}>
          <Stat
            value={folderCount}
            label={t('overview.folders', { count: folderCount })}
            to={foldersAddress(notebookId)}
          />
          <Stat value={notes.length} label={t('overview.notes', { count: notes.length })} />
          <Stat
            value={count(files)}
            label={t('overview.attachments', { count: files.data?.length ?? 0 })}
            to={attachmentsAddress(notebookId)}
          />
          <Stat
            value={count(tables)}
            label={t('overview.tables', { count: tables.data?.length ?? 0 })}
            to={tablesAddress(notebookId)}
          />
          <Stat
            value={count(dashboards)}
            label={t('overview.dashboards', { count: dashboards.data?.length ?? 0 })}
            to={dashboardsAddress(notebookId)}
          />

          <Stat
            value={health.isError ? UNREAD : health.data ? pending.length : undefined}
            label={t('overview.pending', { count: pending.length })}
            to={pending.length > 0 ? '#overview-pending' : undefined}
            attention={pending.length > 0}
          />
          <Stat
            value={health.isError ? UNREAD : health.data ? orphans.length : undefined}
            label={t('overview.orphans', { count: orphans.length })}
            to={orphans.length > 0 ? '#overview-orphans' : undefined}
            attention={orphans.length > 0}
          />
        </ul>

        <section className="overview-section" aria-labelledby="overview-lately">
          <h2 id="overview-lately">{t('overview.lately')}</h2>
          {lately.length === 0 ? (
            <p className="hint">{t('overview.noNotes')}</p>
          ) : (
            <ul className="row-card">
              {lately.map(({ note, folder }) => (
                <li key={note.id}>
                  <Link to={noteAddress(notebookId, note.id)} className="overview-row">
                    <span className="overview-row-name">{note.name ?? t('note.unnamed')}</span>
                    <span className="overview-row-meta">
                      {folder} · {formatDay(note.updatedAt, locale)} ·{' '}
                      <span className={byAgent(note.updatedBy) ? 'is-agent' : undefined}>
                        {authorLabel(note.updatedBy, me, t)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {pending.length > 0 ? (
          <section
            id="overview-pending"
            className="overview-section"
            aria-labelledby="overview-pending-title"
          >
            <h2 id="overview-pending-title">{t('overview.pendingTitle')}</h2>
            <p className="hint">{t('overview.pendingHint')}</p>
            <ul className="row-card">
              {pending.slice(0, LOOSE_ENDS).map((link) => (
                <li key={`${link.fromNote.noteId}-${link.targetName}`}>
                  <Link
                    to={linkTargetAddress(notebookId, link.targetName)}
                    className="overview-row"
                  >
                    <span className="overview-row-name">[[{link.targetName}]]</span>
                    <span className="overview-row-meta">
                      {t('overview.pendingFrom', { note: link.fromNote.name })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {orphans.length > 0 ? (
          <section
            id="overview-orphans"
            className="overview-section"
            aria-labelledby="overview-orphans-title"
          >
            <h2 id="overview-orphans-title">{t('overview.orphansTitle')}</h2>
            <p className="hint">{t('overview.orphansHint')}</p>
            <ul className="row-card">
              {orphans.slice(0, LOOSE_ENDS).map((note) => (
                <li key={note.noteId}>
                  <Link to={noteAddress(notebookId, note.noteId)} className="overview-row">
                    <span className="overview-row-name">{note.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </>
  );
}

/** One number of the strip, a way into where it is seen when there is one. */
function Stat({
  value,
  label,
  to,
  attention = false,
}: {
  /** Undefined while it is read, a dash when it could not be. */
  value: number | string | undefined;
  label: string;
  to?: string;
  attention?: boolean;
}) {
  const body: ReactNode = (
    <>
      <span className="overview-stat-value">
        {value === undefined ? <SkeletonBar width="2rem" height="1.6rem" /> : value}
      </span>
      <span className="overview-stat-label">{label}</span>
    </>
  );
  const className = `overview-stat${attention ? ' is-attention' : ''}`;
  if (!to) return <li className={className}>{body}</li>;
  return (
    <li className={className}>
      {to.startsWith('#') ? (
        <a href={to} className="overview-stat-link">
          {body}
        </a>
      ) : (
        <Link to={to} className="overview-stat-link">
          {body}
        </Link>
      )}
    </li>
  );
}
