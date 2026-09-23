/**
 * The addresses this interface gives what it shows: identifiers, and nothing
 * else (RN-DSC-045).
 *
 * ```
 * /notebooks/:notebookId
 * /notebooks/:notebookId/folders
 * /notebooks/:notebookId/folders/:folderId
 * /notebooks/:notebookId/notes/:noteId
 * /notebooks/:notebookId/links/:target
 * ```
 *
 * **No name, slug, label or folder trail is part of an address.** A segment
 * that is read goes stale the day what it reads is renamed or moved, and a
 * segment nothing reads is a segment somebody eventually starts reading. An
 * identifier never changes, so pasting an address back lands on what it was
 * copied from whatever happened to its name in between (RN-DSC-057). What a
 * person reads is the title of the tab (RN-DSC-058).
 *
 * **A note is not nested under its folder.** A folder in the address of a note
 * would either be read, and moving the note would break it, or be decoration,
 * which is exactly what this design removes.
 *
 * An identifier is written in lower case, because an address somebody looks at
 * should not shout, and read in either case, because Crockford base32 is
 * case-insensitive. What reaches the API is the canonical upper-case form.
 *
 * A link target is the one place a name legitimately lives in an address: a
 * wikilink is a name, a name may be carried by several notes, and the choice
 * between them has an address of its own (RN-DSC-046).
 */

const ULID = /^[0-9a-hjkmnp-tv-z]{26}$/i;

/**
 * The canonical identifier a segment carries, or `null` when it carries none.
 * A segment that is not an identifier addresses nothing, and the page answers
 * not-found without asking the API.
 */
export function identifierOf(segment: string | undefined): string | null {
  return segment !== undefined && ULID.test(segment) ? segment.toUpperCase() : null;
}

const written = (identifier: string): string => identifier.toLowerCase();

export function notebookAddress(notebookId: string): string {
  return `/notebooks/${written(notebookId)}`;
}

/**
 * A folder is addressed under `folders/`, and `folders` alone is no address:
 * the page it named repeated the page of the notebook (#196), and an address
 * of an earlier form answers not-found rather than a redirect (RN-DSC-045).
 */
export function folderAddress(notebookId: string, folderId: string): string {
  return `${notebookAddress(notebookId)}/folders/${written(folderId)}`;
}

/** The address of a note, which every surface that links to one builds. */
export function noteAddress(notebookId: string, noteId: string): string {
  return `${notebookAddress(notebookId)}/notes/${written(noteId)}`;
}

export function guidanceAddress(notebookId: string): string {
  return `${notebookAddress(notebookId)}/guidance`;
}

export function templatesAddress(notebookId: string): string {
  return `${notebookAddress(notebookId)}/templates`;
}

export function graphAddress(notebookId: string): string {
  return `${notebookAddress(notebookId)}/graph`;
}

/**
 * The address of a link target, which is where a name legitimately gets
 * encoded: a route reached by clicking and never by typing (RN-DSC-046).
 */
export function linkTargetAddress(notebookId: string, target: string): string {
  return `${notebookAddress(notebookId)}/links/${encodeURIComponent(target.normalize('NFC'))}`;
}
