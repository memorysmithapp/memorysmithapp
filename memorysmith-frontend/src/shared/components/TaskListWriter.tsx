import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The write behind a task box: optimistic on the screen, grouped in flight.
 *
 * Ticking five items of a checklist should leave ONE entry in the history and
 * not five, so clicks inside a short window collapse into a single write. The
 * grouping is entirely of the client: the server sees an ordinary write, with
 * baseRevision, authorship and a new revision, and nothing about it leaks into
 * the domain.
 *
 * Ticking and unticking the same box inside the window sends nothing at all,
 * because the content went back to being identical (RN-KNW-028).
 */
const WINDOW_MS = 2000;

export interface TaskWrite {
  /** The text as it stands now, with every pending toggle applied. */
  readonly raw: string;
  /** The revision the whole group is based on. */
  readonly baseRevision: string | null;
}

export function useGroupedWrite({
  raw,
  baseRevision,
  write,
  onConflict,
}: {
  raw: string;
  baseRevision: string | null;
  write: (input: TaskWrite) => Promise<unknown>;
  onConflict: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const committed = useRef(raw);

  // The server answered, or the document was reloaded: the draft is stale.
  useEffect(() => {
    committed.current = raw;
    setDraft(null);
  }, [raw]);

  const flush = useCallback(async () => {
    const next = pending.current;
    pending.current = null;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // Identical bytes are not a write: no revision, no event, no reindexing.
    if (next === null || next === committed.current) return;

    try {
      await write({ raw: next, baseRevision });
      committed.current = next;
    } catch (error) {
      // A conflict is information, not a system error: the screen goes back to
      // what the server says and the person is told someone wrote first.
      setDraft(null);
      setFailed(true);
      if ((error as { code?: string })?.code === 'CONFLICT') onConflict();
    }
  }, [baseRevision, onConflict, write]);

  const toggle = useCallback(
    (next: string) => {
      setFailed(false);
      setDraft(next);
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), WINDOW_MS);
    },
    [flush],
  );

  // Leaving the page before the window closes must not lose the click.
  useEffect(() => {
    return () => {
      if (pending.current !== null) void flush();
    };
  }, [flush]);

  return { text: draft ?? raw, toggle, failed };
}
