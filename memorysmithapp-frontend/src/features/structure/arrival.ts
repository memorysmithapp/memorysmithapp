/**
 * Which notebooks somebody is inside of, in this page session.
 *
 * `ResumeReading` resumes on an ARRIVAL at a notebook and answers the Notebook
 * Context on a request from inside it; `NotebookLayout` stays mounted for as
 * long as somebody is inside a notebook and says when they leave. This is the
 * one place both reach, so neither imports the other.
 */
const inside = new Set<string>();

/** Whether entering this notebook now is a return from inside it. */
export function isInside(notebookId: string): boolean {
  return inside.has(notebookId);
}

/** Somebody is in this notebook now. */
export function enterNotebook(notebookId: string): void {
  inside.add(notebookId);
}

/** The notebook was left: the next time somebody enters it, they arrive. */
export function leaveNotebook(notebookId: string): void {
  inside.delete(notebookId);
}
