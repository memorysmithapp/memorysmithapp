import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { noteAddress } from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import { getNotebookStructure, listNotebooks } from '../../shared/api/source';
import { useLiveSession } from '../../shared/auth/session';
import { FolderIcon } from '../../shared/components/icons';
import { SkeletonBar, SkeletonRegion } from '../../shared/components/Skeleton';
import { lastNotesOf } from '../../shared/store/last-note';
import { recentNotes } from '../../shared/store/recent-notes';
import type { FolderNode } from '../../shared/types/api';
import { useIncomingShares } from '../sharing/shares';

/** How many notebooks Home offers to come back to, one row of cards (#428). */
export const SHOWN = 5;

/**
 * Home opens on the way back to what the person was reading (#424): the four
 * notebooks read in last, each with the note read in it, a card each that
 * opens that note.
 *
 * The notebooks this browser dated come first, the newest first; after them,
 * the note it already remembered of every other notebook (#417), so a browser
 * that read before Home kept dates is offered its notebooks too. Only a
 * notebook the person still reaches is offered, named as it is now. Each card
 * says the notebook, the folder and the title of the note (#428), read from the
 * structure of the notebook when Home opens, the cache the notebook itself
 * reads: a note moved or renamed says where it is now, and one gone leaves the
 * list.
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
  const structures = useQueries({
    queries: candidates.map((entry) => ({
      queryKey: queryKeys.notebookStructure(entry.notebookId),
      queryFn: () => getNotebookStructure(entry.notebookId),
      retry: false,
    })),
  });

  if (remembered.length === 0) return null;
  const reading = !names || structures.some((structure) => structure.isPending);
  if (reading) {
    return (
      <SkeletonRegion>
        <div className="continue-grid">
          {remembered.slice(0, SHOWN).map((entry) => (
            <div key={entry.notebookId} className="continue-card" aria-hidden="true">
              <SkeletonBar width="50%" height="0.8rem" />
              <SkeletonBar width="40%" height="0.8rem" />
              <SkeletonBar width="80%" height="1.1rem" />
            </div>
          ))}
        </div>
      </SkeletonRegion>
    );
  }
  const shown = candidates
    .flatMap((entry, at) => {
      const folders = structures[at]?.data?.folders;
      const place = folders ? placeOf(folders, entry.noteId) : null;
      // A note no longer in its notebook, or a notebook no longer read, leaves.
      return place ? [{ entry, ...place }] : [];
    })
    .slice(0, SHOWN);
  if (shown.length === 0) return null;

  return (
    <section className="continue-reading" aria-labelledby="continue-reading-title">
      <h2 id="continue-reading-title">{t('overview.resume')}</h2>
      <div className="continue-grid">
        {shown.map(({ entry, folder, title }) => (
          <Link
            key={entry.notebookId}
            to={noteAddress(entry.notebookId, entry.noteId)}
            className="continue-card"
          >
            <span className="continue-card-notebook">{names?.get(entry.notebookId)}</span>
            <span className="continue-card-folder">
              <FolderIcon width={13} height={13} />
              {folder}
            </span>
            <span className="continue-card-title">{title ?? t('note.unnamed')}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Where a note is in the tree: its folder and its title, or null when it is gone. */
function placeOf(
  folders: FolderNode[],
  noteId: string,
): { folder: string; title: string | null } | null {
  for (const folder of folders) {
    const note = folder.notes.find((each) => each.id === noteId);
    if (note) return { folder: folder.name, title: note.name };
    const below = placeOf(folder.children, noteId);
    if (below) return below;
  }
  return null;
}
