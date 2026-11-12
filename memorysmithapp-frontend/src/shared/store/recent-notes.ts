/**
 * The notebooks a person read in last, each with the note read in it, in this
 * browser, for Home to offer the way back (#424).
 *
 * It lives where the note of one notebook already does (`last-note.ts`), and
 * for the same reasons: kept in the product it would be a write on every note
 * opened, against the quota and carrying an `Authorship` reading does not have
 * (INV-07). So it never leaves the machine, and every person has an entry of
 * their own, since a browser is used by more than one account.
 *
 * **One entry per notebook**, the newest first, so the notes of one notebook do
 * not push every other notebook out. The name of the note is kept as it was
 * when the person opened it, and renewed the next time; the notebook is named
 * by whoever draws the list, from the notebooks the person reaches now, which
 * is also what leaves out one deleted or no longer shared.
 *
 * Everything is inside a try/catch: a browser may refuse storage, and none of
 * this may ever keep somebody from reading.
 */

const PREFIX = 'memorysmith.recentNotes';
const IDENTIFIER = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const PERSON = /^[0-9A-Za-z-]{1,64}$/;
/** More than Home shows, so a notebook that is gone leaves room for the next. */
const KEPT = 12;

export interface RecentNote {
  notebookId: string;
  noteId: string;
  /** The name the note had when it was opened; null when it stated none. */
  noteName: string | null;
  /** When it was opened, as an ISO instant. */
  at: string;
}

function keyOf(personId: string): string {
  return `${PREFIX}.${personId}`;
}

function isRecent(value: unknown): value is RecentNote {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry['notebookId'] === 'string' &&
    IDENTIFIER.test(entry['notebookId']) &&
    typeof entry['noteId'] === 'string' &&
    IDENTIFIER.test(entry['noteId']) &&
    (entry['noteName'] === null || typeof entry['noteName'] === 'string') &&
    typeof entry['at'] === 'string' &&
    !Number.isNaN(Date.parse(entry['at']))
  );
}

function read(personId: string): RecentNote[] {
  try {
    const raw = localStorage.getItem(keyOf(personId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecent) : [];
  } catch {
    return [];
  }
}

function write(personId: string, entries: RecentNote[]): void {
  try {
    localStorage.setItem(keyOf(personId), JSON.stringify(entries.slice(0, KEPT)));
  } catch {
    // Storage refused or full: Home simply offers nothing to continue.
  }
}

/** A note opened: its notebook moves to the front, with this note in it. */
export function rememberRecent(
  personId: string,
  notebookId: string,
  noteId: string,
  noteName: string | null,
  at: Date = new Date(),
): void {
  if (!PERSON.test(personId) || !IDENTIFIER.test(notebookId) || !IDENTIFIER.test(noteId)) return;
  const current = read(personId);
  const first = current[0];
  // The same note, still first and named alike: no write per re-render.
  if (first?.notebookId === notebookId && first.noteId === noteId && first.noteName === noteName) {
    return;
  }
  write(personId, [
    { notebookId, noteId, noteName, at: at.toISOString() },
    ...current.filter((entry) => entry.notebookId !== notebookId),
  ]);
}

/** The notebooks read in last, the newest first, each once. */
export function recentNotes(personId: string): RecentNote[] {
  return PERSON.test(personId) ? read(personId) : [];
}
