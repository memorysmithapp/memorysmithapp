import { useEffect, useRef } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { lastNoteOf, forgetNote } from '../../shared/store/last-note';
import { noteAddress } from '../../shared/api/note-address';
import { folderTrailForNote } from './trail';
import { useNotebookId } from './route-ids';
import { NotebookContextPage } from './NotebookContextPage';
import type { NotebookOutletContext } from './NotebookLayout';

/**
 * Entering a notebook resumes where the reading stopped, and does not.
 *
 * The two halves are both required. Somebody arriving at a notebook is almost
 * always going back to the note they had open, and making them walk the tree
 * again is the friction this exists to remove. But the name of the notebook in
 * the sidebar is also the way BACK to the Notebook Context, and a redirect that
 * fires every time would make that page unreachable from inside the notebook:
 * resuming would have become a trap.
 *
 * So it fires on the FIRST arrival at this notebook in this page session, and
 * never again. Asking for the Notebook Context after that is a request, not an
 * arrival, and it is answered.
 */
const arrived = new Set<string>();

export function ResumeReading() {
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();

  // Decided once per mount, in a ref rather than in state: it must survive a
  // re-render without being recomputed, and it must not be recomputed after
  // the effect below has marked this notebook as arrived at.
  const target = useRef<string | null | undefined>(undefined);
  if (target.current === undefined) {
    target.current = arrived.has(notebookId) ? null : resumable(structure, notebookId);
  }

  useEffect(() => {
    arrived.add(notebookId);
  }, [notebookId]);

  if (target.current) {
    // `replace`, so the notebook index is not left in the history: the back
    // button leaves the notebook instead of bouncing into the note again.
    return <Navigate to={noteAddress(notebookId, target.current)} replace />;
  }
  return <NotebookContextPage />;
}

/**
 * The remembered note, if it is still a note of this notebook.
 *
 * The structure is already in hand, so this costs no request and cannot
 * flash. What is remembered is an identifier, so a rename and a move change
 * nothing about coming back (RN-DSC-057). Only a deleted note lands on the
 * context, and its entry is dropped on the way, because it will never be right
 * again.
 */
function resumable(
  structure: NotebookOutletContext['structure'],
  notebookId: string,
): string | null {
  const noteId = lastNoteOf(notebookId);
  if (!noteId) return null;
  if (folderTrailForNote(structure.folders, noteId).length) return noteId;
  forgetNote(notebookId);
  return null;
}
