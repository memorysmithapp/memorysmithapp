/**
 * Waiting for what the product does after it answers (architecture-guide.md,
 * section 18).
 *
 * Search, the graph, backlinks, facets and the audit trail are projections: a
 * write is answered before they see it. A case asks again until the projection
 * shows what the write did, for as long as the product promises a projection
 * takes, and never sleeps a fixed time: a sleep long enough on a slow day is a
 * wasted minute on every other day.
 */

/** The reindexing target of section 18, 30 s at p95. */
export const PROJECTION_TARGET_MS = 30_000;

export interface EventuallyOptions {
  readonly timeoutMs?: number;
  readonly intervalMs?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly now?: () => number;
}

export async function eventually<T>(
  what: string,
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  options: EventuallyOptions = {},
): Promise<T> {
  const timeout = options.timeoutMs ?? PROJECTION_TARGET_MS;
  const interval = options.intervalMs ?? 1_000;
  const sleep =
    options.sleep ?? ((milliseconds) => new Promise((done) => setTimeout(done, milliseconds)));
  const now = options.now ?? Date.now;

  const deadline = now() + timeout;
  for (;;) {
    const value = await read();
    if (accept(value)) return value;
    if (now() >= deadline) {
      const seen = JSON.stringify(value) ?? String(value);
      throw new Error(
        `${what} did not happen within ${timeout / 1000} s. Last seen: ${seen.slice(0, 500)}`,
      );
    }
    await sleep(interval);
  }
}
