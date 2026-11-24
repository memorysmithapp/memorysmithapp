import { useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { identifierOf } from '../../shared/api/note-address';
import { rememberNote } from '../../shared/store/last-note';
import { rememberRecent } from '../../shared/store/recent-notes';
import { useLiveSession } from '../../shared/auth/session';
import { folderTrailForNote } from './trail';
import { useNotebookId } from './route-ids';
import type { NotebookOutletContext } from './NotebookLayout';
import { lazyPage } from '../../shared/lib/lazy-page';

/**
 * The note itself, with its editor, arrives when it is opened (#547); this route
 * does not wait for it, so where the reading stopped is remembered the moment
 * the address names the note, however long the note takes to arrive.
 */
const NotePage = lazyPage(() => import('../note/NotePage').then((module) => module.NotePage));

/**
 * A note, addressed by its identifier alone (RN-DSC-045).
 *
 * A segment that is not an identifier answers not-found without a request.
 * One that is, in either case, is the note: nothing about its name or its
 * folder is part of the address, so renaming or moving it changes nothing
 * about reaching it (RN-DSC-057).
 *
 * Opening a note is what "where the reading stopped" means, and only a note of
 * this notebook is remembered: a folder listing is a step on the way to one,
 * and an identifier the tree does not hold is not somewhere to come back to.
 */
export function NoteRoute() {
  const { t } = useTranslation();
  const { noteId: segment } = useParams();
  const notebookId = useNotebookId();
  const personId = useLiveSession((s) => s.session?.userId ?? '');
  const { structure } = useOutletContext<NotebookOutletContext>();
  const noteId = identifierOf(segment);
  const trail = noteId === null ? [] : folderTrailForNote(structure.folders, noteId);
  const inTree = trail.length > 0;
  // Its name as the tree has it, which Home shows to come back to it (#424).
  const name = inTree
    ? (trail[trail.length - 1]?.notes.find((note) => note.id === noteId)?.name ?? null)
    : null;

  useEffect(() => {
    if (!noteId || !inTree) return;
    rememberNote(personId, notebookId, noteId);
    rememberRecent(personId, notebookId, noteId, name);
  }, [personId, notebookId, noteId, inTree, name]);

  if (!noteId) return <p className="status">{t('common.notFound')}</p>;
  return <NotePage noteId={noteId} />;
}
