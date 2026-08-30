/**
 * The storage quota of the subscription, applied (RN-SUB-019, RN-SUB-021).
 *
 * Two things have to be true at once for this to be usable, and they pull in
 * opposite directions:
 *
 *  - The count cannot be maintained inside the write. A single counter touched
 *    by every note write is precisely the contention PE10 forbids for the vault
 *    META item, and a per-subscription counter would be worse, since it is one
 *    item for the whole account. So the count is maintained by the outbox relay,
 *    outside the user transaction (section 10.3), and it is therefore SLIGHTLY
 *    BEHIND: a burst of writes can cross the line before the counter catches up.
 *  - The limit still has to mean something. It does, because the number it
 *    lags behind by is bounded by what is in flight, and the check runs on
 *    every write: the subscription can end up a little over the line, never
 *    unboundedly over it.
 *
 * That trade is deliberate and is the standard one for storage limits. What it
 * buys is a hot path that stays exactly as fast as it was.
 */

import { DomainError, err, ok, type Result } from '@memorysmith/kernel';

/** What the subscription is storing now, and what its plan allows. */
export interface StorageState {
  /** Live content: current revision of every note not deleted, plus guidance
   *  and templates. Superseded revisions are stored and not counted. */
  readonly usedBytes: number;
  /** The ceiling declared by the plan (RN-SUB-019). */
  readonly limitBytes: number;
}

/**
 * The port the use cases read it through. It is one port and not two because
 * a budget is a single fact with two halves, and no use case ever wants one
 * half alone. The composition root is what joins them: the used bytes come
 * from the Knowledge table, the limit from the subscription in Access.
 */
export interface StorageBudget {
  current(): Promise<StorageState>;
}

/**
 * Decides one write. Refuses only what GROWS the stored content: a write that
 * shrinks it, or leaves it the same, goes through even when the subscription
 * is already over the line. Otherwise being over the limit would trap someone
 * inside it, unable to shorten the very note that put them there.
 */
export function admitWrite(state: StorageState, delta: number): Result<void, DomainError> {
  if (delta <= 0) return ok();
  if (state.usedBytes + delta <= state.limitBytes) return ok();
  return err(
    DomainError.limitExceeded('This subscription has no storage left for this write', {
      usedBytes: state.usedBytes,
      limitBytes: state.limitBytes,
      requestedBytes: delta,
    }),
  );
}
