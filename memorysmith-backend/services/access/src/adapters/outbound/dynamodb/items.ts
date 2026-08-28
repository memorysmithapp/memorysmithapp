/**
 * Outbox items of mv-access. Same shape as the Knowledge outbox, because the
 * relay that drains them is the same mechanism: state change and publication
 * are atomic, or "wrote but did not publish" happens silently
 * (architecture-guide.md, section 10.4).
 */

import type { DomainEvent } from '@memorysmith/kernel';

export type Item = Record<string, unknown>;

const OUTBOX_TTL_DAYS = 7;

export function outboxItemFor(event: DomainEvent, partition: string): Item {
  return {
    PK: partition,
    SK: `EVENT#${event.eventId}`,
    entity: 'EVENT',
    eventId: event.eventId,
    type: event.type,
    occurredAt: event.occurredAt.toISOString(),
    subscriptionId: event.subscriptionId.value,
    subject: event.subject,
    subjectId: event.subjectId,
    authorship: event.authorship.toJSON(),
    contentRef: event.contentRef ? event.contentRef.toJSON() : null,
    payload: event.payload,
    ttl: event.occurredAt.plusDays(OUTBOX_TTL_DAYS).toEpochSeconds(),
  };
}

/**
 * Where the repository reports what it just wrote to the outbox. In production
 * this is a no-op, because the stream is what publishes; in tests it is what
 * lets a case assert on the event stream without a container.
 */
export interface OutboxSink {
  published(events: DomainEvent[]): Promise<void>;
}

export const NULL_OUTBOX_SINK: OutboxSink = {
  async published(): Promise<void> {
    // The DynamoDB stream carries them from here (section 10.4).
  },
};
