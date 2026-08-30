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
    storageDelta: item['storageDelta'] ?? 0,
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
      const notes = counterDelta(envelope.type);
      const bytes = envelope.storageDelta;
      // An event that moves neither counter needs no transaction, and needs no
      // SEEN item either: there is nothing to apply twice.
      if (notes === 0 && bytes === 0) continue;
      const item = events[index] as Record<string, unknown>;
      await this.applyCounters(String(item['PK']), envelope, notes, bytes);
    }

    return { published: envelopes.length };
  }

  /**
   * One transaction per event, carrying everything that event moves: the note
   * counters of the folder and the vault, and the stored bytes of the whole
   * subscription (RN-SUB-021). They travel together because they share one
   * dedup marker: two transactions would mean the second one is refused by the
   * SEEN item the first one wrote.
   */
  private async applyCounters(
    partition: string,
    envelope: {
      eventId: string;
      occurredAt: string;
      subscriptionId: string;
      payload: Record<string, unknown>;
    },
    notes: number,
    bytes: number,
  ): Promise<void> {
    const folderId = String(envelope.payload['folderId'] ?? '');

    const occurredAt = Instant.fromISO(envelope.occurredAt);
    const ttl = occurredAt.ok
      ? occurredAt.value.plusDays(SEEN_TTL_DAYS).toEpochSeconds()
      : Instant.now().plusDays(SEEN_TTL_DAYS).toEpochSeconds();

    const writes: NonNullable<
      ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']
    > = [
      {
        Put: {
          TableName: this.deps.tableName,
          Item: { PK: partition, SK: `SEEN#${envelope.eventId}`, entity: 'SEEN', ttl },
          ConditionExpression: 'attribute_not_exists(SK)',
        },
      },
    ];

    if (notes !== 0 && folderId) {
      writes.push(
        {
          Update: {
            TableName: this.deps.tableName,
            Key: { PK: partition, SK: `FSTAT#${folderId}` },
            UpdateExpression: 'ADD noteCount :delta SET updatedAt = :at',
            ExpressionAttributeValues: { ':delta': notes, ':at': envelope.occurredAt },
          },
        },
        {
          Update: {
            TableName: this.deps.tableName,
            Key: { PK: partition, SK: 'FSTAT' },
            UpdateExpression: 'ADD noteCount :delta SET updatedAt = :at',
            ExpressionAttributeValues: { ':delta': notes, ':at': envelope.occurredAt },
          },
        },
      );
    }

    if (bytes !== 0) {
      // One item per subscription, in the subscription's own partition rather
      // than a vault's: what a plan limits is the subscription, and a vault in
      // the bin is still holding its bytes.
      writes.push({
        Update: {
          TableName: this.deps.tableName,
          Key: { PK: `S#${envelope.subscriptionId}#VAULTS`, SK: 'USAGE' },
          UpdateExpression: 'ADD storedBytes :delta SET updatedAt = :at',
          ExpressionAttributeValues: { ':delta': bytes, ':at': envelope.occurredAt },
        },
      });
    }

    if (writes.length === 1) return;

    try {
      await this.deps.db.send(new TransactWriteCommand({ TransactItems: writes }));
    } catch (error) {
      // A duplicate SEEN item means the stream is replaying: the counters were
      // already applied, and doing nothing is the correct outcome.
      const name = (error as { name?: string })?.name ?? '';
      if (name !== 'TransactionCanceledException') throw error;
    }
  }
}
