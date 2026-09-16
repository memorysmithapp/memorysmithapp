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

import { GatewayError, type NoteListing, type NotePage } from './gateway.js';

/** What one page holds when the caller does not say. */
export const DEFAULT_PAGE_SIZE = 100;
/** The most one page may hold, whatever the caller asks. */
export const MAX_PAGE_SIZE = 500;

type OrderKey = readonly [folderRank: number, position: string, noteId: string];

function compare(left: OrderKey, right: OrderKey): number {
  if (left[0] !== right[0]) return left[0] - right[0];
  if (left[1] !== right[1]) return left[1] < right[1] ? -1 : 1;
  if (left[2] !== right[2]) return left[2] < right[2] ? -1 : 1;
  return 0;
}

function encode(note: NoteListing): string {
  return Buffer.from(JSON.stringify([note.folderId, note.position, note.noteId]), 'utf8').toString(
    'base64url',
  );
}

function decode(cursor: string): [string, string, string] {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (
      Array.isArray(value) &&
      value.length === 3 &&
      value.every((each) => typeof each === 'string')
    ) {
      return value as [string, string, string];
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
 * One page of the index. `folderOrder` is the folders of the notebook in the
 * defined order, which is how notes of different folders are ordered.
 */
export function pageOf(
  notes: readonly NoteListing[],
  folderOrder: readonly string[],
  input: { limit?: number | undefined; cursor?: string | undefined },
): NotePage {
  const rank = new Map(folderOrder.map((folderId, index) => [folderId, index]));
  const keyOf = (note: NoteListing): OrderKey => [
    rank.get(note.folderId) ?? Number.MAX_SAFE_INTEGER,
    note.position,
    note.noteId,
  ];
  const limit = Math.min(Math.max(1, Math.floor(input.limit ?? DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE);

  const ordered = [...notes].sort((left, right) => compare(keyOf(left), keyOf(right)));
  let start = 0;
  if (input.cursor) {
    const [folderId, position, noteId] = decode(input.cursor);
    const after: OrderKey = [rank.get(folderId) ?? Number.MAX_SAFE_INTEGER, position, noteId];
    start = ordered.findIndex((note) => compare(keyOf(note), after) > 0);
    if (start === -1) start = ordered.length;
  }

  const page = ordered
    .slice(start, start + limit)
    .map(({ noteId, name, folderId, position }) => ({ noteId, name, folderId, position }));
  const last = page[page.length - 1];
  const more = start + limit < ordered.length;
  return { notes: page, nextCursor: more && last ? encode(last) : null };
}
