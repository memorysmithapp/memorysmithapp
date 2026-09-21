/**
 * Every query key this interface holds, named once (#170).
 *
 * It exists because of a defect that could not fail: a write invalidated
 * `['structure', notebookId]`, which no query in the product holds, and
 * `invalidateQueries` on an unregistered key is a **silent no-op** — nothing
 * warns, nothing throws, and the only symptom is a screen that does not
 * change. A rename landed on the note and left the folder tree, and with it
 * the whole link index, showing the old name until a reload.
 *
 * So a key is a function call here, and a key nobody holds is a compile error
 * rather than a call that quietly does nothing. The second thing it buys is
 * the list itself: what this SPA caches, and therefore what any write has to
 * consider invalidating, is readable in one place for the first time.
 *
 * Adding a query means adding it here. That is the whole convention.
 */

/** The notes of the loaded structure are what decide how a `[[…]]` paints. */
export const queryKeys = {
  /** The catalogue of the account. */
  notebooks: () => ['notebooks'] as const,

  /** Four numbers about everything the account holds. */
  liveStats: () => ['live-stats'] as const,

  /**
   * The tree of a notebook: its folders, its notes and their names. It is also
   * the **link index** — `notesReaching` answers out of it — so anything that
   * changes the name of a note invalidates this, or every wikilink in the
   * notebook keeps painting by what the name used to be.
   */
  notebookStructure: (notebookId: string) => ['notebook-structure', notebookId] as const,

  /** The aliases of a notebook, which resolve what no name resolves (§5.2, step 8). */
  notebookNames: (notebookId: string) => ['notebook-names', notebookId] as const,

  /** The files a notebook keeps, which a note reaches by name. */
  notebookFiles: (notebookId: string) => ['notebook-files', notebookId] as const,

  notebookSearch: (notebookId: string, query: string) =>
    ['notebook-search', notebookId, query] as const,

  /**
   * One note. `noteId` is nullable because a transclusion builds the key from
   * a target it has not resolved yet, and holds the query disabled until it
   * has: the key is honest about that rather than inventing an empty string.
   */
  note: (notebookId: string, noteId: string | null) => ['note', notebookId, noteId] as const,

  noteHistory: (notebookId: string, noteId: string) =>
    ['note-history', notebookId, noteId] as const,

  /** The Template of one folder. `undefined` while the folder is not resolved. */
  template: (notebookId: string, folderId: string | undefined) =>
    ['template', notebookId, folderId] as const,

  /** What one wikilink target reaches, when the page had to ask the server. */
  linkTarget: (notebookId: string | undefined, target: string | undefined) =>
    ['link-target', notebookId, target] as const,

  /** The short-lived URL of one file of a notebook. */
  fileLink: (notebookId: string, fileId: string | undefined) =>
    ['file-link', notebookId, fileId] as const,

  /** Everything on its way in or out, which is one list for the whole account. */
  transfers: () => ['transfers'] as const,
} as const;

type KeyFactory = (typeof queryKeys)[keyof typeof queryKeys];

/**
 * A key this interface actually holds.
 *
 * It is what every `invalidates` prop takes, so a component cannot be handed a
 * key nobody registered — which is exactly the shape the defect had.
 */
export type InterfaceQueryKey = ReturnType<KeyFactory>;
