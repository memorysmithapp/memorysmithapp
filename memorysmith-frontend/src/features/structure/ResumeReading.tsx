import { useEffect, useRef } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { lastNoteOf, forgetNote } from '../../shared/store/last-note';
import { noteAddress } from '../../shared/api/note-address';
import { useLiveSession } from '../../shared/auth/session';
import { folderTrailForNote } from './trail';
import { useNotebookId } from './route-ids';
import { enterNotebook, isInside } from './arrival';
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
 * So it fires on every ARRIVAL at this notebook — from Home, from a card,
 * from Transfers, from the address bar — and not while somebody is inside it.
 * Asking for the Notebook Context from the sidebar, the trail or the sheet is
 * a request, not an arrival, and it is answered. What tells the two apart is
 * whether the notebook was left in between: `NotebookLayout` stays mounted for
 * as long as somebody is inside a notebook, and calls `leaveNotebook` when they
 * go. It used to be the first arrival of the page session only, and sharing is
 * what showed it was wrong: a notebook is shared, accepted and answered from
 * Home, so the reading went to Home and came back to the context every time.
 */
export function ResumeReading() {
  const notebookId = useNotebookId();
  const personId = useLiveSession((s) => s.session?.userId ?? '');
  const { structure } = useOutletContext<NotebookOutletContext>();

  // Decided once per mount, in a ref rather than in state: it must survive a
  // re-render without being recomputed, and it must not be recomputed after
  // the effect below has marked this notebook as arrived at.
  const target = useRef<string | null | undefined>(undefined);
  if (target.current === undefined) {
    target.current = isInside(notebookId) ? null : resumable(structure, personId, notebookId);
  }

  useEffect(() => {
    enterNotebook(notebookId);
  }, [notebookId]);

  if (target.current) {
    // `replace`, so the notebook index is not left in the history: the back
    // button leaves the notebook instead of bouncing into the note again.
    return <Navigate to={noteAddress(notebookId, target.current)} replace />;
  }
  return <NotebookContextPage />;
}

/**
 * The note this person had open, if it is still a note of this notebook.
 *
 * The structure is already in hand, so this costs no request and cannot
 * flash. What is remembered is an identifier, so a rename and a move change
 * nothing about coming back (RN-DSC-057). Only a deleted note lands on the
 * context, and its entry is dropped on the way, because it will never be right
 * again.
 */
function resumable(
  structure: NotebookOutletContext['structure'],
  personId: string,
  notebookId: string,
): string | null {
  const noteId = lastNoteOf(personId, notebookId);
  if (!noteId) return null;
  if (folderTrailForNote(structure.folders, noteId).length) return noteId;
  forgetNote(personId, notebookId);
  return null;
}
