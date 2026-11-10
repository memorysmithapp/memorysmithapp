import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { noteAddress } from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import { listNotebooks } from '../../shared/api/source';
import { useLiveSession } from '../../shared/auth/session';
import { HistoryIcon } from '../../shared/components/icons';
import { SkeletonBar, SkeletonRegion } from '../../shared/components/Skeleton';
import { recentNotes } from '../../shared/store/recent-notes';
import { useIncomingShares } from '../sharing/shares';

/** How many notebooks Home offers to come back to. */
export const SHOWN = 4;

/**
 * Home opens on the way back to what the person was reading (#424): the four
 * notebooks read in last, the newest first, each with the note read in it, a
 * card each that opens that note. Only a notebook the person still reaches is
 * offered, named as it is called now; with nothing to continue, nothing is
 * drawn.
 */
export function ContinueReading() {
  const { t } = useTranslation();
  const me = useLiveSession((s) => s.session?.userId ?? '');
  const notebooks = useQuery({ queryKey: queryKeys.notebooks(), queryFn: listNotebooks });
  const shares = useIncomingShares();
  // Read once per visit to Home: it is this browser's, and nothing else moves it.
  const recent = useMemo(() => recentNotes(me), [me]);

  const names = useMemo(() => {
    if (!notebooks.data || shares.isPending) return null;
    const named = new Map(notebooks.data.map((notebook) => [notebook.id, notebook.name]));
    for (const share of shares.data ?? []) {
      if (share.state === 'accepted') named.set(share.notebookId, share.name);
    }
    return named;
  }, [notebooks.data, shares.isPending, shares.data]);

  if (recent.length === 0) return null;
  if (!names) {
    return (
      <SkeletonRegion>
        <div className="continue-grid">
          {recent.slice(0, SHOWN).map((entry) => (
            <div key={entry.notebookId} className="overview-resume" aria-hidden="true">
              <SkeletonBar width="60%" height="2.4rem" />
            </div>
          ))}
        </div>
      </SkeletonRegion>
    );
  }
  const shown = recent.filter((entry) => names.has(entry.notebookId)).slice(0, SHOWN);
  if (shown.length === 0) return null;

  return (
    <section className="continue-reading" aria-labelledby="continue-reading-title">
      <h2 id="continue-reading-title">{t('overview.resume')}</h2>
      <div className="continue-grid">
        {shown.map((entry) => (
          <Link
            key={entry.notebookId}
            to={noteAddress(entry.notebookId, entry.noteId)}
            className="overview-resume"
          >
            <span className="overview-resume-icon">
              <HistoryIcon />
            </span>
            <span className="overview-resume-text">
              <span className="overview-resume-name">{entry.noteName ?? t('note.unnamed')}</span>
              <span className="overview-resume-folder">{names.get(entry.notebookId)}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
