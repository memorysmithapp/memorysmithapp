/**
 * The event consumer: the inbound adapter of svc-audit.
 *
 * It validates every envelope against its contract before anything else, on
 * this side of the bus as well as on the producing side, because an envelope
 * only one end knows is how a projection starts lying quietly (section 19).
 *
 * The Audit context consumes EVERY event of EVERY service, and the only thing
 * it does with them is append (RN-AUD-001).
 */

import {
  AgentIdentity,
  Authorship,
  ContentId,
  ContentRef,
  type DomainError,
  Instant,
  SubscriptionId,
  UserId,
  type DomainEventType,
  type EventSubject,
  type Result,
} from '@memorysmith/kernel';
import { parseEvent, type EventEnvelope } from '@memorysmith/contracts';
import { AuditEvent } from '../../domain/index.js';
import type { RecordEvents } from '../../application/index.js';

function need<T>(result: Result<T, DomainError>): T {
  if (!result.ok) throw new Error(`Unusable event on the bus: ${result.error.message}`);
  return result.value;
}

function toAuditEvent(envelope: EventEnvelope): AuditEvent {
  const authorship = envelope.authorship.agent
    ? Authorship.byAgent(
        need(UserId.create(envelope.authorship.userId)),
        need(
          AgentIdentity.create(
            envelope.authorship.agent.clientId,
            envelope.authorship.agent.clientName,
          ),
        ),
        need(Instant.fromISO(envelope.authorship.at)),
      )
    : Authorship.byHuman(
        need(UserId.create(envelope.authorship.userId)),
        need(Instant.fromISO(envelope.authorship.at)),
      );

  const contentRef = envelope.contentRef
    ? need(
        ContentRef.create({
          contentId: need(ContentId.create(envelope.contentRef.contentId)),
          versionId: envelope.contentRef.versionId,
          sha256: envelope.contentRef.sha256,
          bytes: envelope.contentRef.bytes,
        }),
      )
    : null;

  return need(
    AuditEvent.create({
      eventId: envelope.eventId,
      subscriptionId: need(SubscriptionId.fromClaim(envelope.subscriptionId)),
      subject: envelope.subject as EventSubject,
      subjectId: envelope.subjectId,
      occurredAt: need(Instant.fromISO(envelope.occurredAt)),
      type: envelope.type as DomainEventType,
      authorship,
      contentRef,
      payload: envelope.payload as Record<string, unknown>,
    }),
  );
}

export class AuditEventConsumer {
  constructor(private readonly record: RecordEvents) {}

  /** Takes raw envelopes as they arrive from EventBridge or from a test. */
  async consume(raw: unknown[]): Promise<{ appended: number }> {
    const events = raw.map((each) => toAuditEvent(parseEvent(each)));
    const result = await this.record.execute(events);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }
}

export { toAuditEvent };
