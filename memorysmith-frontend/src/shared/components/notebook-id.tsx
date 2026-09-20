import { createContext, useContext, type ReactNode } from 'react';

/**
 * Which notebook the page is drawing (#166).
 *
 * The reading surface needs it in one place that has no way of asking for it:
 * a file is kept BY a notebook, and the component that draws one is reached
 * through the Markdown renderer, which is handed a string and nothing else.
 * Threading a prop through every node of a document to serve one leaf is how
 * a renderer stops being a renderer.
 *
 * It is a context and not a module variable because two notebooks can be on
 * one screen — a transclusion of a note of another notebook is not a thing
 * today, and a global would be a bet that it never will be.
 */
const NotebookId = createContext<string | null>(null);

export function NotebookIdProvider({
  notebookId,
  children,
}: {
  notebookId: string;
  children: ReactNode;
}) {
  return <NotebookId.Provider value={notebookId}>{children}</NotebookId.Provider>;
}

/** The notebook of the page, or `null` where a surface is drawn outside one. */
export function useNotebookId(): string | null {
  return useContext(NotebookId);
}
