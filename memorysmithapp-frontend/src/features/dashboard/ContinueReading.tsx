import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../shared/api/error-mapper';
import { noteAddress } from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import { getNote, listNotebooks } from '../../shared/api/source';
import { useLiveSession } from '../../shared/auth/session';
import { HistoryIcon } from '../../shared/components/icons';
import { SkeletonBar, SkeletonRegion } from '../../shared/components/Skeleton';
import { lastNotesOf } from '../../shared/store/last-note';
import { recentNotes } from '../../shared/store/recent-notes';
import { useIncomingShares } from '../sharing/shares';

/** How many notebooks Home offers to come back to. */
export const SHOWN = 4;

/**
 * Home opens on the way back to what the person was reading (#424): the four
 * notebooks read in last, each with the note read in it, a card each that
 * opens that note.
 *
 * The notebooks this browser dated come first, the newest first; after them,
 * the note it already remembered of every other notebook (#417), so a browser
 * that read before Home kept dates is offered its notebooks too. Only a
 * notebook the person still reaches is offered, named as it is now, and each
 * note is read when Home opens: a renamed note says its name now, and a
 * deleted one leaves the list.
 */
export function ContinueReading() {
  const { t } = useTranslation();
  const me = useLiveSession((s) => s.session?.userId ?? '');
  const notebooks = useQuery({ queryKey: queryKeys.notebooks(), queryFn: listNotebooks });
  const shares = useIncomingShares();

  // Read once per visit to Home: it is this browser's, and nothing else moves it.
  const remembered = useMemo(() => {
    const dated = recentNotes(me).map(({ notebookId, noteId }) => ({ notebookId, noteId }));
    const seen = new Set(dated.map((entry) => entry.notebookId));
    return [...dated, ...lastNotesOf(me).filter((entry) => !seen.has(entry.notebookId))];
  }, [me]);

  const names = useMemo(() => {
    if (!notebooks.data || shares.isPending) return null;
    const named = new Map(notebooks.data.map((notebook) => [notebook.id, notebook.name]));
    for (const share of shares.data ?? []) {
      if (share.state === 'accepted') named.set(share.notebookId, share.name);
    }
    return named;
  }, [notebooks.data, shares.isPending, shares.data]);

  // The first four of the notebooks still reached; a note that is gone gives
  // its place to the next.
  const candidates = names
    ? remembered.filter((entry) => names.has(entry.notebookId)).slice(0, SHOWN * 2)
    : [];
  const notes = useQueries({
    queries: candidates.map((entry) => ({
      queryKey: queryKeys.note(entry.notebookId, entry.noteId),
      queryFn: () => getNote(entry.notebookId, entry.noteId),
      retry: false,
    })),
  });

  if (remembered.length === 0) return null;
  const reading = !names || notes.some((note) => note.isPending);
  if (reading) {
    return (
      <SkeletonRegion>
        <div className="continue-grid">
          {remembered.slice(0, SHOWN).map((entry) => (
            <div key={entry.notebookId} className="overview-resume" aria-hidden="true">
              <SkeletonBar width="60%" height="2.4rem" />
            </div>
          ))}
        </div>
      </SkeletonRegion>
    );
  }
  const shown = candidates
    .map((entry, at) => ({ entry, note: notes[at] }))
    .filter(({ note }) => {
      if (note?.data) return true;
      // Gone, or no longer readable: it leaves the list. Any other failure
      // keeps it, named as the notebook is.
      return !(note?.error instanceof ApiError && note.error.status === 404);
    })
    .slice(0, SHOWN);
  if (shown.length === 0) return null;

  return (
    <section className="continue-reading" aria-labelledby="continue-reading-title">
      <h2 id="continue-reading-title">{t('overview.resume')}</h2>
      <div className="continue-grid">
        {shown.map(({ entry, note }) => (
          <Link
            key={entry.notebookId}
            to={noteAddress(entry.notebookId, entry.noteId)}
            className="overview-resume"
          >
            <span className="overview-resume-icon">
              <HistoryIcon />
            </span>
            <span className="overview-resume-text">
              <span className="overview-resume-name">{note?.data?.name ?? t('note.unnamed')}</span>
              <span className="overview-resume-folder">{names?.get(entry.notebookId)}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
