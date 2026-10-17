import { create } from 'zustand';

/**
 * The edit sessions of the screen that hold typing the server does not have
 * yet (#301), by an identifier of each.
 *
 * A link inside the product never reaches `beforeunload`, so leaving a page
 * with a save waiting is asked by the router — and a router holds ONE blocker
 * at a time. One note had one session; the page of the Templates holds one per
 * card, and each asking on its own left only the last one asking. So every
 * session says here whether it is waiting and how to send what it holds, and
 * the layout of the notebook asks once for all of them.
 */
interface EditSessionsState {
  readonly waiting: ReadonlyMap<string, () => Promise<void>>;
  /** The session holds typing, and `flush` sends it; `null` when it holds none. */
  hold: (id: string, flush: (() => Promise<void>) | null) => void;
}

export const useEditSessions = create<EditSessionsState>((set) => ({
  waiting: new Map(),
  hold: (id, flush) =>
    set((state) => {
      const waiting = new Map(state.waiting);
      if (flush) waiting.set(id, flush);
      else waiting.delete(id);
      return { waiting };
    }),
}));

/** Sends what every session holds, as a person leaving the page agreed to. */
export function flushEverySession(): Promise<void> {
  const flushes = [...useEditSessions.getState().waiting.values()];
  return Promise.allSettled(flushes.map((flush) => flush())).then(() => undefined);
}
