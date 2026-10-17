import { useCallback, useEffect, useRef, useState } from 'react';
import { messageKeyOf } from '../api/error-mapper';
import { revisionChain } from '../api/revision-chain';
import { useWriteStatus } from '../store/write-status';

/**
 * The write behind a task box: optimistic on the screen, one write per tick.
 *
 * The reading surface queues the ticks and asks for the next one only once the
 * last one settled, showing *Updating…* on the item meanwhile (#300): so a tick
 * is written at once, and its promise is what the item waits on. Ticking five
 * items is five revisions, and the history still shows them as one entry,
 * because every write of one visit to the note carries the same session
 * (RN-AUD-013) — the grouping is made where the history is read, never by
 * holding a click back.
 */

export interface TaskWrite {
  /** The text as it stands now, with every pending toggle applied. */
  readonly raw: string;
  /** The revision the write is based on. */
  readonly baseRevision: string | null;
  /**
   * True when the page is going away. The request has to be made in a way the
   * browser finishes after the document is gone, or the click is lost.
   */
  readonly keepalive?: boolean;
}

/**
 * A write answers the revision it produced. That is the other half of
 * optimistic concurrency, and the half this used to be missing.
 */
export type TaskWriter = (input: TaskWrite) => Promise<string>;

export function useTaskWrite({
  raw,
  baseRevision,
  write,
  onWritten,
  onConflict,
}: {
  raw: string;
  baseRevision: string | null;
  write: TaskWriter;
  /**
   * Called after a write LANDS, so the surface can drop what it is holding
   * and read what the server now has.
   *
   * Without it the screen kept showing the content it was rendered with:
   * `staleTime: Infinity` means a query is never refetched on its own, so
   * leaving the note and coming back showed the state from before the edit,
   * and only a reload — which drops the cache with the page — fixed it. The
   * write had landed all along.
   */
  onWritten: () => void;
  onConflict: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  /**
   * The item says *Updating…* and *Not saved* where the click happened; the
   * frame of the screen says what a failure was, in the words of the error
   * taxonomy, because a message that invents a cause sends the reader looking
   * for a person who was never there.
   */
  const status = useWriteStatus();
  const committed = useRef(raw);
  /**
   * The callbacks, held in refs and called THROUGH them.
   *
   * Both arrive as inline arrows, so they are new functions on every render,
   * and the chain below is built once. Capturing the first ones directly
   * happens to work today — they close over a notebook id and a note id that
   * do not change while the note is mounted — and "happens to work" is the
   * reasoning that produced the last three defects of this feature. The
   * indirection costs a line and removes the question.
   */
  const writeRef = useRef(write);
  const writtenRef = useRef(onWritten);
  writeRef.current = write;
  writtenRef.current = onWritten;

  /**
   * The revision the next write is based on, advancing on every success.
   * Everything about why is in `revision-chain.ts`, which is also where it is
   * tested: two writes in a row is not a case a rendering test reaches.
   */
  const chain = useRef(
    revisionChain(
      (input) => writeRef.current(input),
      baseRevision,
      () => writtenRef.current(),
    ),
  );

  // The document was reloaded: the draft is stale and so is the revision.
  useEffect(() => {
    committed.current = raw;
    setDraft(null);
  }, [raw]);

  // A reload brings a revision of its own, and it wins: it comes from the
  // server, and what is held here is only what this session wrote.
  useEffect(() => {
    chain.current.reset(baseRevision);
  }, [baseRevision]);

  /**
   * A tick, written at once; the promise settles when the write did, and
   * rejects when it did not, which returns the box to what its source holds.
   */
  const toggle = useCallback(
    async (next: string): Promise<void> => {
      setDraft(next);
      // Identical bytes are not a write: no revision, no event, no reindexing.
      if (next === committed.current) return;
      try {
        status.saving();
        await chain.current.write(next);
        committed.current = next;
        status.saved();
      } catch (error) {
        // A conflict is information, not a system error: the screen goes back
        // to what the server says and the person is told someone wrote first.
        setDraft(null);
        const conflict = (error as { code?: string })?.code === 'CONFLICT';
        status.failed(conflict ? 'note.writeConflict' : messageKeyOf(error));
        if (conflict) onConflict();
        throw error;
      }
    },
    [onConflict, status],
  );

  return { text: draft ?? raw, toggle };
}
