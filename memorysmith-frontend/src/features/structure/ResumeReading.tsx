import { useEffect, useRef } from 'react';
import { Navigate, useOutletContext, useParams } from 'react-router-dom';
import { lastNoteOf, forgetNote } from '../../shared/store/last-note';
import { folderTrailForNote, noteAt } from './trail';
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
  const { notebookSlug = '' } = useParams();
  const { structure } = useOutletContext<NotebookOutletContext>();

  // Decided once per mount, in a ref rather than in state: it must survive a
  // re-render without being recomputed, and it must not be recomputed after
  // the effect below has marked this notebook as arrived at.
  const target = useRef<string | null | undefined>(undefined);
  if (target.current === undefined) {
    target.current = arrived.has(notebookSlug) ? null : resumable(structure, notebookSlug);
  }

  useEffect(() => {
    arrived.add(notebookSlug);
  }, [notebookSlug]);

  if (target.current) {
    // `replace`, so the notebook index is not left in the history: the back
    // button leaves the notebook instead of bouncing into the note again.
    return <Navigate to={`/notebooks/${notebookSlug}/root/${target.current}`} replace />;
  }
  return <NotebookContextPage />;
}

/**
 * The remembered note, if it is still a note of this notebook.
 *
 * The structure is already in hand, so this costs no request and cannot
 * flash, and a remembered address now **survives a retitle and a move**: it
 * carries the identifier, so what changed is the decoration and the route
 * corrects it (RN-DSC-045). Only a deleted note lands on the tree, and its
 * stale entry is dropped on the way, because it will never be right again.
 */
function resumable(
  structure: NotebookOutletContext['structure'],
  notebookSlug: string,
): string | null {
  const path = lastNoteOf(notebookSlug);
  if (!path) return null;
  const noteId = noteAt(structure.folders, path);
  if (noteId && folderTrailForNote(structure.folders, noteId).length) return path;
  forgetNote(notebookSlug);
  return null;
}
