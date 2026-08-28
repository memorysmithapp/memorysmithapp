/**
 * The Audit context. Its whole domain is one shape and one operation, and the
 * poverty is the point: the trail is APPEND-ONLY (RN-AUD-001), so there is
 * nothing else it could do.
 *
 * The key is BY SUBJECT, not by vault (architecture-guide.md, section 12.2).
 * That is what makes the timeline of a note survive it changing folder and
 * vault, and it is the reason moving a note is a command instead of a delete
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
      ),
    );
  }

  get changedContent(): boolean {
    return this.contentRef !== null;
  }
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
  /** Activity inside a vault over a period, for the activity screen. */
  activityOf(vaultId: string, from: Instant | null, to: Instant | null): Promise<AuditEvent[]>;
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
