/**
 * Where the reading stopped, per person and per notebook, in this browser.
 *
 * It is deliberately NOT in the product. Remembering across devices would mean
 * a write on every note opened — on the hottest path of the reading surface,
 * against the quota, and carrying an `Authorship` that reading does not have,
 * since design rule 7 requires one for every change of state. The convenience
 * does not pay for that. So this lives in `localStorage`, never leaves the
 * machine, is never exported and is never seen by anybody else.
 *
 * **What is remembered is the identifier of a note, per notebook identifier.**
 * An entry written before 0.6.0 is keyed by the slug of a notebook and holds a
 * path, and it is dropped rather than followed: following it would mean
 * reading a name out of an address, which is the tolerance the address gave up
 * (RN-DSC-045). Starting over costs one navigation.
 *
 * **And it is kept per person.** Since a notebook can be shared (RN-ACC-024),
 * the same notebook identifier is read by more than one person, and a browser
 * is often used by more than one account — its owner and the person it is
 * shared with, one after the other. Keyed by the notebook alone, each of them
 * moved the other's place. So every person has an entry of their own, under the
 * identifier of their account, and nothing one reads moves where another
 * stopped. The entry written before that, under no person at all, cannot be
 * told apart and is dropped: starting over costs one navigation.
 *
 * Everything here is inside a try/catch, because a browser can refuse storage
 * outright and none of this may ever keep somebody from opening a notebook.
 */

const PREFIX = 'memorysmith.lastNote';
const IDENTIFIER = /^[0-9A-HJKMNP-TV-Z]{26}$/;
/** The `sub` of an account: a UUID in Cognito, and never empty or spaced. */
const PERSON = /^[0-9A-Za-z-]{1,64}$/;

type Remembered = Record<string, string>;

function keyOf(personId: string): string {
  return `${PREFIX}.${personId}`;
}

function read(personId: string): Remembered {
  try {
    const raw = localStorage.getItem(keyOf(personId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    // Anything but identifiers pointing at identifiers is somebody else's data
    // or a version of ours that no longer exists.
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([notebookId, noteId]) =>
          IDENTIFIER.test(notebookId) && typeof noteId === 'string' && IDENTIFIER.test(noteId),
      ),
    ) as Remembered;
  } catch {
    return {};
  }
}

function write(personId: string, next: Remembered): void {
  try {
    localStorage.setItem(keyOf(personId), JSON.stringify(next));
    // The entry of nobody in particular, from before notebooks were shared.
    localStorage.removeItem(PREFIX);
  } catch {
    // Storage refused or full: the notebook still opens, at its context.
  }
}

/**
 * Remembers the note a person has open in a notebook, all three by their
 * canonical identifiers. Without a person nothing is remembered: a place that
 * belongs to nobody would be found by whoever signs in next.
 */
export function rememberNote(personId: string, notebookId: string, noteId: string): void {
  if (!PERSON.test(personId) || !IDENTIFIER.test(notebookId) || !IDENTIFIER.test(noteId)) return;
  const current = read(personId);
  if (current[notebookId] === noteId) return; // no write per re-render
  write(personId, { ...current, [notebookId]: noteId });
}

export function lastNoteOf(personId: string, notebookId: string): string | null {
  if (!PERSON.test(personId)) return null;
  return read(personId)[notebookId] ?? null;
}

export function forgetNote(personId: string, notebookId: string): void {
  if (!PERSON.test(personId)) return;
  const current = read(personId);
  if (!(notebookId in current)) return;
  const { [notebookId]: _removed, ...rest } = current;
  write(personId, rest);
}
