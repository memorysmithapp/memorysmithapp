/**
 * Outbox relay: DynamoDB Streams to EventBridge (architecture-guide.md, 10.4).
 *
 * The outbox exists because "I wrote but did not publish" happens, and happens
 * silently. In a system whose audit trail lives on events, that silence would
 * be a hole in the record.
 *
 * The relay also maintains the folder and vault counters (section 10.3),
 * OUTSIDE the user transaction. To avoid counting twice when the stream
 * reprocesses, the increment travels with a dedup item:
 *
 *   TransactWriteItems
 *     Put     SK = SEEN#{eventUlid}   ConditionExpression attribute_not_exists  (TTL 7d)
 *     Update  SK = FSTAT#{folderId}   ADD noteCount :delta
 *
 * Eventually consistent counting is acceptable on purpose: the number guides
 * the agent and the UI and takes part in no invariant.
 */

import { type EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { TransactWriteCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { parseEvent } from '@memorysmith/contracts';
import { Instant } from '@memorysmith/kernel';

/** The shape a stream record arrives in, narrowed to what the relay reads. */
export interface StreamRecord {
  eventName?: string | undefined;
  dynamodb?:
    | {
        NewImage?: Record<string, unknown> | undefined;
      }
    | undefined;
}

export interface RelayDependencies {
  readonly db: DynamoDBDocumentClient;
  readonly bus: EventBridgeClient;
  readonly tableName: string;
  readonly busName: string;
  readonly source: string;
}

const SEEN_TTL_DAYS = 7;

/** Which events move a counter, and in which direction. */
function counterDelta(type: string): number {
  switch (type) {
    case 'NoteCreated':
    case 'NoteRestored':
      return 1;
    case 'NoteDeleted':
      return -1;
    default:
      return 0;
  }
}

/**
 * Turns one outbox item into the published envelope. Unmarshalling is done by
 * the caller (the Lambda entrypoint owns the stream format); this function
 * takes the plain item and is therefore testable without any AWS type.
 */
export function envelopeOf(item: Record<string, unknown>): unknown {
  return {
    eventId: item['eventId'],
    type: item['type'],
    occurredAt: item['occurredAt'],
    subscriptionId: item['subscriptionId'],
    subject: item['subject'],
    subjectId: item['subjectId'],
    authorship: item['authorship'],
    contentRef: item['contentRef'] ?? null,
    payload: item['payload'] ?? {},
  };
}

export class OutboxRelay {
  constructor(private readonly deps: RelayDependencies) {}

  /**
   * Processes a batch of new outbox items. Anything that is not an INSERT of
   * an EVENT# item is ignored, which is what lets the same stream carry the
   * ordinary writes too.
   */
  async process(items: Array<Record<string, unknown>>): Promise<{ published: number }> {
    const events = items.filter((item) => String(item['entity'] ?? '') === 'EVENT');
    if (events.length === 0) return { published: 0 };

    // Validate on the producing side as well: an envelope only one side knows
    // is how a projection starts lying quietly (section 19).
    const envelopes = events.map((item) => parseEvent(envelopeOf(item)));

    await this.deps.bus.send(
      new PutEventsCommand({
        Entries: envelopes.map((envelope) => ({
          EventBusName: this.deps.busName,
          Source: this.deps.source,
          DetailType: envelope.type,
          Detail: JSON.stringify(envelope),
          Time: new Date(envelope.occurredAt),
        })),
      }),
    );

    for (const [index, envelope] of envelopes.entries()) {
      const delta = counterDelta(envelope.type);
      if (delta === 0) continue;
      const item = events[index] as Record<string, unknown>;
      await this.applyCounter(String(item['PK']), envelope, delta);
    }

    return { published: envelopes.length };
  }

  private async applyCounter(
    partition: string,
    envelope: { eventId: string; occurredAt: string; payload: Record<string, unknown> },
    delta: number,
  ): Promise<void> {
    const folderId = String(envelope.payload['folderId'] ?? '');
    if (!folderId) return;

    const occurredAt = Instant.fromISO(envelope.occurredAt);
    const ttl = occurredAt.ok
      ? occurredAt.value.plusDays(SEEN_TTL_DAYS).toEpochSeconds()
      : Instant.now().plusDays(SEEN_TTL_DAYS).toEpochSeconds();

    try {
      await this.deps.db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.deps.tableName,
                Item: { PK: partition, SK: `SEEN#${envelope.eventId}`, entity: 'SEEN', ttl },
                ConditionExpression: 'attribute_not_exists(SK)',
              },
            },
            {
              Update: {
                TableName: this.deps.tableName,
                Key: { PK: partition, SK: `FSTAT#${folderId}` },
                UpdateExpression: 'ADD noteCount :delta SET updatedAt = :at',
                ExpressionAttributeValues: { ':delta': delta, ':at': envelope.occurredAt },
              },
            },
            {
              Update: {
                TableName: this.deps.tableName,
                Key: { PK: partition, SK: 'FSTAT' },
                UpdateExpression: 'ADD noteCount :delta SET updatedAt = :at',
                ExpressionAttributeValues: { ':delta': delta, ':at': envelope.occurredAt },
              },
            },
          ],
        }),
      );
    } catch (error) {
      // A duplicate SEEN item means the stream is replaying: the counter was
      // already applied, and doing nothing is the correct outcome.
      const name = (error as { name?: string })?.name ?? '';
      if (name !== 'TransactionCanceledException') throw error;
    }
  }
}
