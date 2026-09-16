/**
 * Outbox relay: DynamoDB Streams to EventBridge (architecture-guide.md, 10.4).
 *
 * The outbox exists because "I wrote but did not publish" happens, and happens
 * silently. In a system whose audit trail lives on events, that silence would
 * be a hole in the record.
 *
 * The relay also maintains the folder and notebook counters (section 10.3),
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

import {
  type EventBridgeClient,
  PutEventsCommand,
  type PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
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

/**
 * What one PutEvents call accepts: ten entries, and a request under its size
 * limit, kept well below it here. A batch of the stream holds up to 25 events,
 * and sending it in one call had the bus refuse the whole batch whenever a burst
 * of writes put more than ten in it: an import, an agent writing a notebook, a
 * folder removed with its notes.
 */
const MAX_ENTRIES_PER_CALL = 10;
const MAX_BYTES_PER_CALL = 200_000;

function sizeOf(entry: PutEventsRequestEntry): number {
  return (
    Buffer.byteLength(entry.Detail ?? '', 'utf8') +
    Buffer.byteLength(entry.DetailType ?? '', 'utf8') +
    Buffer.byteLength(entry.Source ?? '', 'utf8')
  );
}

export function callsOf(entries: readonly PutEventsRequestEntry[]): PutEventsRequestEntry[][] {
  const calls: PutEventsRequestEntry[][] = [];
  let current: PutEventsRequestEntry[] = [];
  let bytes = 0;
  for (const entry of entries) {
    const size = sizeOf(entry);
    if (
      current.length === MAX_ENTRIES_PER_CALL ||
      (current.length > 0 && bytes + size > MAX_BYTES_PER_CALL)
    ) {
      calls.push(current);
      current = [];
      bytes = 0;
    }
    current.push(entry);
    bytes += size;
  }
  if (current.length > 0) calls.push(current);
  return calls;
}

/**
 * Which events move the note counters, by how much, and whether the counter of
 * ONE FOLDER moves with the counter of the notebook.
 *
 * `FolderRemoved` is the one that moves the notebook counter alone: the folder
 * counters of the removed subtree were deleted by the same write, and
 * recreating one to decrement it would leave an orphan item holding a negative
 * number. It carries how many notes the subtree held, because nothing under it
 * was written and no note event will ever say those notes are gone.
 */
function counterDelta(
  type: string,
  payload: Record<string, unknown>,
): {
  notes: number;
  folder: boolean;
} {
  switch (type) {
    case 'NoteCreated':
      return { notes: 1, folder: true };
    case 'NoteDeleted':
      return { notes: -1, folder: true };
    case 'FolderRemoved':
      return { notes: -Number(payload['noteCount'] ?? 0), folder: false };
    default:
      return { notes: 0, folder: false };
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

    const entries: PutEventsRequestEntry[] = envelopes.map((envelope) => ({
      EventBusName: this.deps.busName,
      Source: this.deps.source,
      DetailType: envelope.type,
      Detail: JSON.stringify(envelope),
      Time: new Date(envelope.occurredAt),
    }));

    for (const call of callsOf(entries)) {
      const answer = await this.deps.bus.send(new PutEventsCommand({ Entries: call }));
      // PutEvents answers 200 with the entries it refused counted, not thrown.
      // An event the bus did not take fails the batch, so the stream delivers
      // it again. Delivery is at least once, and an event delivered twice
      // changes nothing (architecture-guide.md, section 10.4).
      const refused = answer?.FailedEntryCount ?? 0;
      if (refused > 0) {
        const reasons = new Set(
          (answer.Entries ?? [])
            .filter((entry) => entry.ErrorCode)
            .map((entry) => `${entry.ErrorCode}: ${entry.ErrorMessage ?? ''}`),
        );
        throw new Error(
          `The event bus refused ${refused} of ${call.length} events: ${[...reasons].join('; ')}`,
        );
      }
    }

    for (const [index, envelope] of envelopes.entries()) {
      const { notes, folder } = counterDelta(envelope.type, envelope.payload);
      const bytes = envelope.storageDelta;
      // An event that moves neither counter needs no transaction, and needs no
      // SEEN item either: there is nothing to apply twice.
      if (notes === 0 && bytes === 0) continue;
      const item = events[index] as Record<string, unknown>;
      await this.applyCounters(String(item['PK']), envelope, notes, bytes, folder);
    }

    return { published: envelopes.length };
  }

  /**
   * One transaction per event, carrying everything that event moves: the note
   * counters of the folder and the notebook, and the stored bytes of the whole
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
    countsFolder: boolean,
  ): Promise<void> {
    const folderId = countsFolder ? String(envelope.payload['folderId'] ?? '') : '';

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
      writes.push({
        Update: {
          TableName: this.deps.tableName,
          Key: { PK: partition, SK: `FSTAT#${folderId}` },
          UpdateExpression: 'ADD noteCount :delta SET updatedAt = :at',
          ExpressionAttributeValues: { ':delta': notes, ':at': envelope.occurredAt },
        },
      });
    }
    if (notes !== 0) {
      writes.push({
        Update: {
          TableName: this.deps.tableName,
          Key: { PK: partition, SK: 'FSTAT' },
          UpdateExpression: 'ADD noteCount :delta SET updatedAt = :at',
          ExpressionAttributeValues: { ':delta': notes, ':at': envelope.occurredAt },
        },
      });
    }

    if (bytes !== 0) {
      // One item per subscription, in the subscription's own partition rather
      // than a notebook's: what a plan limits is the subscription, and a
      // notebook waiting for the purge is still holding its bytes.
      writes.push({
        Update: {
          TableName: this.deps.tableName,
          Key: { PK: `S#${envelope.subscriptionId}#NOTEBOOKS`, SK: 'USAGE' },
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
