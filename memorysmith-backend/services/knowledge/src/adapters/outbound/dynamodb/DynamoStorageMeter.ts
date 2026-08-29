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

import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SubscriptionContext } from '@memorysmith/kernel';
import { KnowledgeKeys } from './keys.js';

export class DynamoStorageMeter {
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
        Key: { PK: this.keys.subscriptionVaults(), SK: this.keys.storageUsage() },
        ProjectionExpression: 'storedBytes',
      }),
    );
    const stored = Number(found.Item?.['storedBytes'] ?? 0);
    // A counter can only be driven negative by a bug upstream; reporting a
    // negative usage would then hand the whole quota back as a bonus.
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  }
}
