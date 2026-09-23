/**
 * Reads the stored-bytes counter of the subscription (RN-SUB-021).
 *
 * It only reads. The counter is written by the outbox relay, outside the user
 * transaction (section 10.3), which is what keeps a limit on the whole account
 * from turning every note write into a fight over one item.
 *
 * The limit itself is not here: it belongs to the subscription, which lives in
 * Access, and Knowledge never reaches into another context. The composition
 * root joins the two halves into the StorageBudget port.
 */

import { GetCommand, QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SubscriptionContext } from '@memorysmith/kernel';
import {
  EMPTY_SUBSCRIPTION_USAGE,
  type NotebookUsageCounters,
  type StorageUsageReader,
  type StorageUsageSnapshot,
  type SubscriptionUsageCounters,
} from '../../../domain/services/StorageUsage.js';
import { KnowledgeKeys, NOTEBOOK_USAGE_PREFIX } from './keys.js';

/** A counter as it is read: a number, and never a negative one. */
function counter(value: unknown): number {
  const number = Number(value ?? 0);
  // A counter can only be driven negative by a bug upstream or a delta that
  // arrived before its pair; answering a negative count helps nobody.
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

export class DynamoStorageMeter implements StorageUsageReader {
  private readonly keys: KnowledgeKeys;

  constructor(
    context: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {
    this.keys = new KnowledgeKeys(context.subscriptionId);
  }

  /**
   * Bytes of live content. A subscription that has never written has no
   * counter item at all, and that reads as zero rather than as an error.
   */
  async usedBytes(): Promise<number> {
    const found = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.subscriptionNotebooks(), SK: this.keys.storageUsage() },
        ProjectionExpression: 'storedBytes',
      }),
    );
    const stored = Number(found.Item?.['storedBytes'] ?? 0);
    // A counter can only be driven negative by a bug upstream; reporting a
    // negative usage would then hand the whole quota back as a bonus.
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }

  /**
   * What fills the space, by kind and by notebook (RN-SUB-024): the `USAGE`
   * item and every `NBUSAGE#` line beside it, in the one partition of the
   * subscription. Two reads, whatever the subscription holds, and not one of
   * them reaches a note or a file.
   */
  async read(): Promise<StorageUsageSnapshot> {
    const partition = this.keys.subscriptionNotebooks();
    const [totals, lines] = await Promise.all([
      this.db.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { PK: partition, SK: this.keys.storageUsage() },
        }),
      ),
      this.notebookLines(partition),
    ]);

    const item = totals.Item ?? {};
    const subscription = Object.fromEntries(
      (Object.keys(EMPTY_SUBSCRIPTION_USAGE) as Array<keyof SubscriptionUsageCounters>).map(
        (name) => [name, counter(item[name])],
      ),
    ) as unknown as SubscriptionUsageCounters;

    const notebooks = new Map<string, NotebookUsageCounters>();
    for (const line of lines) {
      const notebookId = String(line['notebookId'] ?? '');
      if (!notebookId) continue;
      notebooks.set(notebookId, {
        bytes: counter(line['bytes']),
        notes: counter(line['notes']),
        folders: counter(line['folders']),
        files: counter(line['files']),
      });
    }
    return { subscription, notebooks };
  }

  private async notebookLines(partition: string): Promise<Array<Record<string, unknown>>> {
    const lines: Array<Record<string, unknown>> = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': partition, ':prefix': NOTEBOOK_USAGE_PREFIX },
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      lines.push(...((page.Items ?? []) as Array<Record<string, unknown>>));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return lines;
  }
}
