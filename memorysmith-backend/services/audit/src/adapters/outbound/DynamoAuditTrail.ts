/**
 * mv-audit (architecture-guide.md, section 12.2):
 *
 *   PK  S#{s}#{subject}#{subjectId}      SK  AT#{timestamp}#{eventUlid}
 *
 * One Query by PK returns the complete timeline of any object, in
 * chronological order, with no scan.
 *
 * THE IMMUTABILITY IS NOT IN THIS FILE. The role of this Lambda carries an
 * explicit IAM Deny on UpdateItem and DeleteItem for this table (PE4), which
 * is the difference between "we do not alter the log" and "we cannot alter the
 * log". Only the second one answers a regulator, and only the second one is
 * what the isolation test in the suite asserts.
 */

import {
  BatchWriteCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
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
import { AuditEvent, type AuditTrail } from '../../domain/index.js';

type Item = Record<string, unknown>;

function need<T>(result: Result<T, DomainError>): T {
  if (!result.ok) throw new Error(`Corrupted item in mv-audit: ${result.error.message}`);
  return result.value;
}

function partitionOf(event: AuditEvent): string {
  return `S#${event.subscriptionId.value}#${event.subject}#${event.subjectId}`;
}

function sortKeyOf(event: AuditEvent): string {
  return `AT#${event.occurredAt.toISOString()}#${event.eventId}`;
}

export class DynamoAuditTrail implements AuditTrail {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    /** The subscription of the reading session; writes take it per event. */
    private readonly subscriptionId: SubscriptionId | null = null,
  ) {}

  async append(events: AuditEvent[]): Promise<void> {
    for (let index = 0; index < events.length; index += 25) {
      const chunk = events.slice(index, index + 25);
      await this.db.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: chunk.map((event) => ({
              PutRequest: {
                Item: {
                  PK: partitionOf(event),
                  SK: sortKeyOf(event),
                  entity: 'AUDIT',
                  eventId: event.eventId,
                  subscriptionId: event.subscriptionId.value,
                  subject: event.subject,
                  subjectId: event.subjectId,
                  occurredAt: event.occurredAt.toISOString(),
                  type: event.type,
                  authorship: event.authorship.toJSON(),
                  contentRef: event.contentRef ? event.contentRef.toJSON() : null,
                  payload: event.payload,
                  // Lets the activity screen ask "what happened in this vault".
                  ...(vaultOf(event)
                    ? {
                        GSI1PK: `S#${event.subscriptionId.value}#VAULTACT#${vaultOf(event)}`,
                        GSI1SK: sortKeyOf(event),
                      }
                    : {}),
                },
              },
            })),
          },
        }),
      );
    }
  }

  async timelineOf(subject: EventSubject, subjectId: string): Promise<AuditEvent[]> {
    if (!this.subscriptionId) throw new Error('Reading the trail requires a subscription');
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `S#${this.subscriptionId.value}#${subject}#${subjectId}`,
        },
        ScanIndexForward: true,
      }),
    );
    return ((response.Items ?? []) as Item[]).map((item) => parse(item));
  }

  async activityOf(
    vaultId: string,
    from: Instant | null,
    to: Instant | null,
  ): Promise<AuditEvent[]> {
    if (!this.subscriptionId) throw new Error('Reading the trail requires a subscription');
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression:
          from && to
            ? 'GSI1PK = :pk AND GSI1SK BETWEEN :from AND :to'
            : from
              ? 'GSI1PK = :pk AND GSI1SK >= :from'
              : 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `S#${this.subscriptionId.value}#VAULTACT#${vaultId}`,
          ...(from ? { ':from': `AT#${from.toISOString()}` } : {}),
          ...(to ? { ':to': `AT#${to.toISOString()}#~` } : {}),
        },
        ScanIndexForward: false,
      }),
    );
    return ((response.Items ?? []) as Item[]).map((item) => parse(item));
  }
}

function vaultOf(event: AuditEvent): string | null {
  const fromPayload = event.payload['vaultId'] ?? event.payload['toVaultId'];
  if (typeof fromPayload === 'string') return fromPayload;
  return event.subject === 'VAULT' ? event.subjectId : null;
}

function parse(item: Item): AuditEvent {
  const authorshipRaw = (item['authorship'] ?? {}) as {
    userId: string;
    agent: { clientId: string; clientName: string } | null;
    at: string;
  };
  const at = need(Instant.fromISO(authorshipRaw.at));
  const user = need(UserId.create(authorshipRaw.userId));
  const authorship = authorshipRaw.agent
    ? Authorship.byAgent(
        user,
        need(AgentIdentity.create(authorshipRaw.agent.clientId, authorshipRaw.agent.clientName)),
        at,
      )
    : Authorship.byHuman(user, at);

  const refRaw = item['contentRef'] as {
    contentId: string;
    versionId: string;
    sha256: string;
    bytes: number;
  } | null;
  const contentRef = refRaw
    ? need(
        ContentRef.create({
          contentId: need(ContentId.create(refRaw.contentId)),
          versionId: refRaw.versionId,
          sha256: refRaw.sha256,
          bytes: refRaw.bytes,
        }),
      )
    : null;

  return need(
    AuditEvent.create({
      eventId: String(item['eventId']),
      subscriptionId: need(SubscriptionId.fromClaim(String(item['subscriptionId']))),
      subject: String(item['subject']) as EventSubject,
      subjectId: String(item['subjectId']),
      occurredAt: need(Instant.fromISO(String(item['occurredAt']))),
      type: String(item['type']) as DomainEventType,
      authorship,
      contentRef,
      payload: (item['payload'] ?? {}) as Record<string, unknown>,
    }),
  );
}

/** In-memory trail for tests, honouring the same append-only contract. */
export class InMemoryAuditTrail implements AuditTrail {
  private readonly events: AuditEvent[] = [];

  async append(events: AuditEvent[]): Promise<void> {
    this.events.push(...events);
  }

  async timelineOf(subject: EventSubject, subjectId: string): Promise<AuditEvent[]> {
    return this.events
      .filter((event) => event.subject === subject && event.subjectId === subjectId)
      .sort((left, right) => left.occurredAt.epochMillis - right.occurredAt.epochMillis);
  }

  async activityOf(
    vaultId: string,
    from: Instant | null,
    to: Instant | null,
  ): Promise<AuditEvent[]> {
    return this.events
      .filter((event) => vaultOf(event) === vaultId)
      .filter((event) => !from || !event.occurredAt.isBefore(from))
      .filter((event) => !to || event.occurredAt.isAtOrBefore(to))
      .sort((left, right) => right.occurredAt.epochMillis - left.occurredAt.epochMillis);
  }

  get all(): AuditEvent[] {
    return [...this.events];
  }
}
