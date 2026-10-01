/**
 * The index of a notebook, in pages an agent can hold (RN-AGT-031).
 *
 * `list_notes` answered every note at once, and each with its size, its
 * instant and a whole authorship: a notebook of 811 notes answered 465 KB, and
 * the client refused to show it. A page carries the four fields an index
 * needs, in the defined order (PP9), and a cursor to continue.
 *
 * The cursor is the ORDER KEY of the last note of the page, not an offset: a
 * note written or deleted between two pages moves every offset after it, and
 * an agent following offsets would read one note twice or skip one. The key
 * of a note does not move when another note arrives, so the next page starts
 * strictly after it.
 */

import { compareByName, type NoteOrder } from '@memorysmith/contracts';
import { GatewayError, type NoteListing, type NotePage } from './gateway.js';

/** What one page holds when the caller does not say. */
export const DEFAULT_PAGE_SIZE = 100;
/** The most one page may hold, whatever the caller asks. */
export const MAX_PAGE_SIZE = 500;

/** A folder of the notebook, in the defined order, and how it orders its notes (RN-KNW-056). */
export interface FolderInOrder {
  readonly folderId: string;
  readonly noteOrder: NoteOrder;
}

/**
 * Where a note sits: its folder, its position, its identifier and its name.
 * Within a folder ordered by hand the position decides; within one ordered by
 * name, the name, with the same comparison the knowledge service and the
 * screen use, so a page never disagrees with what the person sees.
 */
type Place = Pick<NoteListing, 'folderId' | 'position' | 'noteId' | 'name'>;

function encode(note: Place): string {
  return Buffer.from(
    JSON.stringify([note.folderId, note.position, note.noteId, note.name]),
    'utf8',
  ).toString('base64url');
}

/** A cursor answered before names were part of it carries three strings, and is read as one. */
function decode(cursor: string): Place {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (
      Array.isArray(value) &&
      (value.length === 3 || value.length === 4) &&
      value.slice(0, 3).every((each) => typeof each === 'string') &&
      (value[3] === undefined || value[3] === null || typeof value[3] === 'string')
    ) {
      const [folderId, position, noteId, name] = value as [string, string, string, string?];
      return { folderId, position, noteId, name: name ?? null };
    }
  } catch {
    // Falls through to the refusal below.
  }
  throw new GatewayError(
    'VALIDATION',
    'That cursor is not one list_notes answered. Call list_notes without a cursor to start over.',
  );
}

/**
 * One page of the index. `folders` is the folders of the notebook in the
 * defined order, which is how notes of different folders are ordered, each
 * with how it orders its own notes.
 */
export function pageOf(
  notes: readonly NoteListing[],
  folders: readonly FolderInOrder[],
  input: { limit?: number | undefined; cursor?: string | undefined },
): NotePage {
  const rank = new Map(folders.map((folder, index) => [folder.folderId, index]));
  const byName = new Set(
    folders.filter((folder) => folder.noteOrder === 'alphabetical').map((each) => each.folderId),
  );
  const rankOf = (folderId: string) => rank.get(folderId) ?? Number.MAX_SAFE_INTEGER;
  const compare = (left: Place, right: Place): number => {
    const byFolder = rankOf(left.folderId) - rankOf(right.folderId);
    if (byFolder !== 0) return byFolder;
    if (left.folderId !== right.folderId) return left.folderId < right.folderId ? -1 : 1;
    if (byName.has(left.folderId)) return compareByName(left, right);
    if (left.position !== right.position) return left.position < right.position ? -1 : 1;
    return left.noteId < right.noteId ? -1 : left.noteId > right.noteId ? 1 : 0;
  };
  const limit = Math.min(Math.max(1, Math.floor(input.limit ?? DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE);

  const ordered = [...notes].sort(compare);
  let start = 0;
  if (input.cursor) {
    const after = decode(input.cursor);
    start = ordered.findIndex((note) => compare(note, after) > 0);
    if (start === -1) start = ordered.length;
  }

  const page = ordered
    .slice(start, start + limit)
    .map(({ noteId, name, folderId, position }) => ({ noteId, name, folderId, position }));
  const last = page[page.length - 1];
  const more = start + limit < ordered.length;
  return { notes: page, nextCursor: more && last ? encode(last) : null };
}
