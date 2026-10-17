/**
 * An edit session of the interface, read as one entry of a history (#300,
 * RN-AUD-013).
 *
 * The note editor saves as the person types, a pause at a time, and every save
 * is a revision: immutable, in the trail, reachable by `asOf` like any other
 * (RN-KNW-027, RN-AUD-001, RN-AUD-005). Rewriting one revision as an edit grew
 * would keep one line per edit and break all three, so the saves are grouped
 * where the history is READ, never where it is written: each one carries the
 * identifier of the session it belongs to, and a history shows a run of saves
 * of one session as one entry that opens into them.
 *
 * The grouping lives here because two places read a history — the screen and
 * the connector's `note_history` — and they may not disagree about what one
 * entry is.
 */

/** What the grouping reads of an entry: the session it belongs to, or none. */
export interface InSession {
  readonly session: string | null;
}

/** One entry of a grouped history: a write on its own, or the saves of one session. */
export type HistoryGroup<T extends InSession> =
  | { readonly kind: 'entry'; readonly entry: T }
  | {
      readonly kind: 'session';
      readonly session: string;
      /** The saves of the session, in the order the trail recorded them; never empty. */
      readonly entries: readonly T[];
    };

/**
 * Groups a history in the order it was recorded. Only a RUN of saves of one
 * session becomes one entry: a write of somebody else between two of them is
 * part of what happened, and it splits the session where it fell rather than
 * being moved out of the way. A write with no session — every write of an
 * agent, and every event that is not a save — is an entry of its own.
 */
export function groupHistory<T extends InSession>(entries: readonly T[]): HistoryGroup<T>[] {
  const groups: HistoryGroup<T>[] = [];
  for (const entry of entries) {
    const last = groups.at(-1);
    if (entry.session === null) {
      groups.push({ kind: 'entry', entry });
    } else if (last?.kind === 'session' && last.session === entry.session) {
      groups[groups.length - 1] = { ...last, entries: [...last.entries, entry] };
    } else {
      groups.push({ kind: 'session', session: entry.session, entries: [entry] });
    }
  }
  return groups;
}
