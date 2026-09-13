/**
 * Where the reading stopped, per notebook, in this browser.
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
 * Everything here is inside a try/catch, because a browser can refuse storage
 * outright and none of this may ever keep somebody from opening a notebook.
 */

const KEY = 'memorysmith.lastNote';
const IDENTIFIER = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type Remembered = Record<string, string>;

function read(): Remembered {
  try {
    const raw = localStorage.getItem(KEY);
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

function write(next: Remembered): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage refused or full: the notebook still opens, at its context.
  }
}

/** Remembers the note open in a notebook, both by their canonical identifiers. */
export function rememberNote(notebookId: string, noteId: string): void {
  if (!IDENTIFIER.test(notebookId) || !IDENTIFIER.test(noteId)) return;
  const current = read();
  if (current[notebookId] === noteId) return; // no write per re-render
  write({ ...current, [notebookId]: noteId });
}

export function lastNoteOf(notebookId: string): string | null {
  return read()[notebookId] ?? null;
}

export function forgetNote(notebookId: string): void {
  const current = read();
  if (!(notebookId in current)) return;
  const { [notebookId]: _removed, ...rest } = current;
  write(rest);
}
