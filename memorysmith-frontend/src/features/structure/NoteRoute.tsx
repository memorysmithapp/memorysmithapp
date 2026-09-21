import { useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NotePage } from '../note/NotePage';
import { identifierOf } from '../../shared/api/note-address';
import { rememberNote } from '../../shared/store/last-note';
import { folderTrailForNote } from './trail';
import { useNotebookId } from './route-ids';
import type { NotebookOutletContext } from './NotebookLayout';

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
  const { structure } = useOutletContext<NotebookOutletContext>();
  const noteId = identifierOf(segment);
  const inTree = noteId !== null && folderTrailForNote(structure.folders, noteId).length > 0;

  useEffect(() => {
    if (noteId && inTree) rememberNote(notebookId, noteId);
  }, [notebookId, noteId, inTree]);

  if (!noteId) return <p className="status">{t('common.notFound')}</p>;
  return <NotePage noteId={noteId} />;
}
