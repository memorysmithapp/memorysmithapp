/**
 * The Audit context. Its whole domain is one shape and one operation, and the
 * poverty is the point: the trail is APPEND-ONLY (RN-AUD-001), so there is
 * nothing else it could do.
 *
 * The key is BY SUBJECT, not by notebook (architecture-guide.md, section 12.2).
 * That is what makes the timeline of a note survive it changing folder and
 * notebook, and it is the reason moving a note is a command instead of a delete
 * plus a create.
 */

import {
  DomainError,
  err,
  type Instant,
  ok,
  type Authorship,
  type ContentRef,
  type DomainEventType,
  type EventSubject,
  type Result,
  type SubscriptionId,
} from '@memorysmith/kernel';

export class AuditEvent {
  private constructor(
    readonly eventId: string,
    readonly subscriptionId: SubscriptionId,
    readonly subject: EventSubject,
    readonly subjectId: string,
    readonly occurredAt: Instant,
    readonly type: DomainEventType,
    readonly authorship: Authorship,
    /** The exact revision of the content at that instant (RN-AUD-003). */
    readonly contentRef: ContentRef | null,
    readonly payload: Record<string, unknown>,
    /**
     * The transfer that brought this entry in, when it did not happen here
     * (RN-PRT-023). An entry the product wrote itself carries none, so the
     * trail can always answer where a line came from.
     */
    readonly importedBy: string | null = null,
  ) {}

  static create(input: {
    eventId: string;
    subscriptionId: SubscriptionId;
    subject: EventSubject;
    subjectId: string;
    occurredAt: Instant;
    type: DomainEventType;
    authorship: Authorship;
    contentRef: ContentRef | null;
    payload: Record<string, unknown>;
    importedBy?: string | null;
  }): Result<AuditEvent, DomainError> {
    if (!input.subjectId) {
      return err(DomainError.validation('An audit event needs a subject'));
    }
    return ok(
      new AuditEvent(
        input.eventId,
        input.subscriptionId,
        input.subject,
        input.subjectId,
        input.occurredAt,
        input.type,
        input.authorship,
        input.contentRef,
        input.payload,
        input.importedBy ?? null,
      ),
    );
  }

  /**
   * A move carries the reference of the note so a projection can reproject it,
   * and it changes no content: it is not a revision of its own.
   */
  get changedContent(): boolean {
    return this.contentRef !== null && this.type !== 'NoteMoved';
  }
}

/**
 * What survives the purge of a notebook (RN-AUD-011).
 *
 * The line is not the subject of the entry but what the entry is ABOUT. A
 * `GuidanceUpdated` carries the notebook as its subject and is content of the
 * notebook; the entries below are the notebook as an object of the
 * subscription — that it was created, renamed, deleted, destroyed, and who
 * could reach it. The subscription keeps those. Everything else that happened
 * inside goes with the notebook.
 *
 * `NotebookRestored` is retired and stays here: an entry already written has
 * to keep meaning what it meant.
 */
export const NOTEBOOK_LIFE_EVENT_TYPES: readonly DomainEventType[] = [
  'NotebookCreated',
  'NotebookRenamed',
  'NotebookDeleted',
  'NotebookRestored',
  'NotebookPurged',
  'NotebookRoleLimitSet',
  'NotebookRoleLimitCleared',
];

export const survivesTheNotebook = (type: DomainEventType): boolean =>
  NOTEBOOK_LIFE_EVENT_TYPES.includes(type);

/**
 * Which notebook an entry belongs to, or none when it is about the
 * subscription itself. The payload answers first, because a note carries the
 * notebook it lives in — and a move carries the one it arrived at, which is
 * where its activity belongs from then on.
 */
export function notebookOf(event: AuditEvent): string | null {
  const fromPayload = event.payload['notebookId'] ?? event.payload['toNotebookId'];
  if (typeof fromPayload === 'string') return fromPayload;
  return event.subject === 'NOTEBOOK' ? event.subjectId : null;
}

/**
 * The only operation is append. There is no update and no delete, here or
 * anywhere else: the immutability is enforced by an explicit IAM Deny on the
 * table, not by this interface (PE4). An interface that simply lacks the
 * method would prove nothing to a regulator.
 */
export interface AuditTrail {
  append(events: AuditEvent[]): Promise<void>;
  /** The complete timeline of one subject, in chronological order. */
  timelineOf(subject: EventSubject, subjectId: string): Promise<AuditEvent[]>;
  /** Activity inside a notebook over a period, for the activity screen. */
  activityOf(notebookId: string, from: Instant | null, to: Instant | null): Promise<AuditEvent[]>;
}

/**
 * Whether the trail of a notebook was closed, which is what the purge does to
 * it (RN-AUD-011). The consumer asks before appending, because the events of
 * the purge itself travel the ordinary way — outbox, bus, consumer — and
 * therefore reach the trail AFTER the purge that wrote them has ended. What
 * the erase could not remove, because it had not arrived yet, is what this
 * keeps out.
 */
export interface ClosedTrails {
  isClosed(subscriptionId: SubscriptionId, notebookId: string): Promise<boolean>;
}

/**
 * The one operation in the system that removes an entry (rule 6, RN-AUD-011).
 *
 * It is a port of its own, reached by ONE principal — the purge worker — for
 * the same reason destroying a revision is (rule 8): a capability that exists
 * in one place is a capability nothing else can reach by accident.
 */
export interface TrailCloser {
  /**
   * Erases everything of that notebook but its life, and closes the trail so
   * nothing of it is appended again. Erasing twice erases nothing.
   */
  close(notebookId: string, at: Instant): Promise<{ erased: number }>;
}

/**
 * Reads a revision straight from the content store, by the pair
 * (contentId, versionId) the event carries. No query to the Knowledge context
 * is involved: the present lives in mv-knowledge, the past lives in mv-audit.
 */
export interface RevisionReader {
  read(ref: ContentRef): Promise<string>;
}

/**
 * Rebuilds what a note said on a date (RN-AUD-005):
 *   1. the last event of that note with timestamp <= the date;
 *   2. a GET of that event's (contentId, versionId).
 * Because the key is opaque, renaming or moving the note afterwards does not
 * affect the reconstruction.
 */
export function revisionAt(timeline: AuditEvent[], asOf: Instant): AuditEvent | null {
  const candidates = timeline
    .filter((event) => event.changedContent && event.occurredAt.isAtOrBefore(asOf))
    .sort((left, right) => left.occurredAt.epochMillis - right.occurredAt.epochMillis);
  return candidates[candidates.length - 1] ?? null;
}
