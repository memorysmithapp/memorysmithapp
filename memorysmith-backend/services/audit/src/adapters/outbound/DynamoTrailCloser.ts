/**
 * The one place in the system that removes an entry of the trail (rule 6,
 * RN-AUD-011, architecture-guide.md §12.2).
 *
 * It is a file of its own, reached through a port of its own, by ONE principal
 * — the purge worker — for the same reason destroying a revision is (rule 8):
 * what exists in one place is what nothing else reaches by accident. Every
 * other role of the system carries an explicit `Deny` on removing from this
 * table, and that stays exactly as it was.
 *
 * Closing a notebook does two things in one pass, and it needs both:
 *
 *   1. it erases every entry of that notebook that is not its life — the
 *      writes of its notes, its Templates, its Guidance, and the purge entries
 *      of each of them;
 *   2. it MARKS the trail closed, because the erase alone cannot finish the
 *      job. The events of the purge travel the ordinary way — outbox, bus,
 *      consumer — so most of them reach the trail after the purge that wrote
 *      them has ended. The consumer asks this mark before appending, and what
 *      arrives late is not appended at all.
 *
 * Closing twice closes nothing: the second pass finds the entries gone and
 * writes the same mark.
 */

import {
  BatchWriteCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { DomainEventType, Instant, SubscriptionId } from '@memorysmith/kernel';
import { survivesTheNotebook, type TrailCloser } from '../../domain/index.js';
import { closedKeyOf } from './DynamoAuditTrail.js';

type Item = Record<string, unknown>;

/** What one BatchWriteItem carries, per the DynamoDB service limit. */
const MAX_BATCH = 25;

/** How many times a batch is offered again what the table handed back. */
const UNPROCESSED_ATTEMPTS = 5;

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * How long the mark is kept. Thirty days is longer than any delivery it
 * defends against, and it is the same span the marker that stops a late event
 * from resurrecting a note is kept for.
 */
export const CLOSED_TRAIL_TTL_DAYS = 30;

export class DynamoTrailCloser implements TrailCloser {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly subscriptionId: SubscriptionId,
    private readonly sleep: (milliseconds: number) => Promise<void> = wait,
  ) {}

  async close(notebookId: string, at: Instant): Promise<{ erased: number }> {
    /**
     * The mark goes FIRST. Between the mark and the erase, an entry that
     * arrives is simply not appended; in the other order, an entry arriving in
     * that window would be appended by a consumer that had not heard yet, and
     * erased by nobody.
     */
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...closedKeyOf(this.subscriptionId.value, notebookId),
          entity: 'TRAILCLOSED',
          subscriptionId: this.subscriptionId.value,
          notebookId,
          closedAt: at.toISOString(),
          ttl: Math.floor(at.epochMillis / 1000) + CLOSED_TRAIL_TTL_DAYS * 24 * 60 * 60,
        },
      }),
    );

    let erased = 0;
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: {
            ':pk': `S#${this.subscriptionId.value}#NOTEBOOKACT#${notebookId}`,
          },
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );

      const doomed = ((page.Items ?? []) as Item[]).filter(
        (item) => !survivesTheNotebook(String(item['type']) as DomainEventType),
      );
      for (let index = 0; index < doomed.length; index += MAX_BATCH) {
        const chunk = doomed.slice(index, index + MAX_BATCH);
        erased += await this.deleteAll(
          chunk.map((item) => ({
            DeleteRequest: { Key: { PK: item['PK'], SK: item['SK'] } },
          })),
        );
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey);

    return { erased };
  }

  /**
   * A batch answers success with what it did not write handed back, and an
   * entry left behind is an entry of a notebook nobody can reach any more. It
   * is offered again with a growing pause, and what is still unwritten after
   * that throws: the purge that called this is delivered again.
   */
  private async deleteAll(requests: Array<{ DeleteRequest: { Key: unknown } }>): Promise<number> {
    let pending = requests;
    for (let attempt = 0; pending.length > 0; attempt++) {
      if (attempt === UNPROCESSED_ATTEMPTS) {
        throw new Error(
          `The trail of a purged notebook kept ${pending.length} entr${pending.length === 1 ? 'y' : 'ies'} the table would not delete`,
        );
      }
      if (attempt > 0) await this.sleep(2 ** attempt * 50);
      const response = await this.db.send(
        new BatchWriteCommand({ RequestItems: { [this.tableName]: pending as never } }),
      );
      pending = (response.UnprocessedItems?.[this.tableName] ?? []) as typeof pending;
    }
    return requests.length;
  }
}
