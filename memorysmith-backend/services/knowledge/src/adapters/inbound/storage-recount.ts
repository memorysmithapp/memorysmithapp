/**
 * Recount of the stored bytes of every subscription (RN-SUB-021).
 *
 * The counter is maintained by the outbox relay, one delta at a time and
 * outside the user transaction (section 10.3). That makes it a DERIVED number,
 * and every derived number in this system owes an answer to the same question:
 * how is it rebuilt when it is wrong or was never built (PE5)? This is that
 * answer for the storage counter.
 *
 * It is needed at least once for real: the counter started existing after the
 * vaults did, so every subscription written before it began at zero while
 * holding a vault full of notes. It is also the repair for the ordinary ways a
 * delta can be lost — a stream record dropped past its retries, a relay bug —
 * and it costs nothing to keep around.
 *
 * WHY THIS IS NOT A ROUTE. A platform session carries no subscription, so no
 * Knowledge repository can be built under it (PE12, RN-SUB-016): an
 * administrator CANNOT read another account's notes, by construction, and that
 * is a guarantee rather than an inconvenience to work around. Recounting every
 * account therefore cannot be an authenticated operation at all. It runs as
 * maintenance, against the table, under IAM.
 *
 * WHAT IT COUNTS is what RN-SUB-021 defines as live content, and nothing else:
 * the current revision of every note that is not deleted, plus each guidance
 * and each template. A vault in the bin still holds its bytes, which is both
 * the rule and the truth: nothing was released, and restoring brings it all
 * back.
 */

import { PutCommand, ScanCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface RecountDependencies {
  readonly db: DynamoDBDocumentClient;
  readonly tableName: string;
}

/** What one subscription turned out to be holding. */
export interface SubscriptionUsage {
  readonly subscriptionId: string;
  readonly storedBytes: number;
  readonly notes: number;
  readonly guidances: number;
  readonly templates: number;
}

/** `S#{subscriptionId}#VAULT#{vaultId}` and `S#{subscriptionId}#VAULTS`. */
const SUBSCRIPTION_OF_KEY = /^S#([^#]+)#/;

/** Reads `bytes` off a serialized ContentRef, tolerating a missing pointer. */
function bytesOf(ref: unknown): number {
  if (typeof ref !== 'object' || ref === null) return 0;
  const bytes = Number((ref as Record<string, unknown>)['bytes']);
  return Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
}

export class StorageRecount {
  constructor(private readonly deps: RecountDependencies) {}

  /**
   * Walks the whole table once and returns what each subscription holds.
   *
   * A Scan, deliberately: there is no index that lists subscriptions, and
   * inventing one to serve a maintenance job would put a cost on every write
   * to save a job that runs by hand. It projects only the four attributes it
   * reads, so the pages stay small.
   */
  async measure(): Promise<SubscriptionUsage[]> {
    const totals = new Map<
      string,
      { bytes: number; notes: number; guidances: number; templates: number }
    >();
    let startKey: Record<string, unknown> | undefined;

    do {
      const page = await this.deps.db.send(
        new ScanCommand({
          TableName: this.deps.tableName,
          ProjectionExpression: 'PK, entity, bodyRef, guidanceRef, templateRef, deletedAt',
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );

      for (const item of page.Items ?? []) {
        const subscriptionId = SUBSCRIPTION_OF_KEY.exec(String(item['PK'] ?? ''))?.[1];
        if (!subscriptionId) continue;

        const current = totals.get(subscriptionId) ?? {
          bytes: 0,
          notes: 0,
          guidances: 0,
          templates: 0,
        };

        switch (String(item['entity'] ?? '')) {
          case 'NOTE': {
            // A deleted note is not live content and its bytes are not counted,
            // exactly as the delete event released them.
            if (item['deletedAt']) break;
            const bytes = bytesOf(item['bodyRef']);
            if (bytes > 0) {
              current.bytes += bytes;
              current.notes += 1;
            }
            break;
          }
          case 'VAULT': {
            const bytes = bytesOf(item['guidanceRef']);
            if (bytes > 0) {
              current.bytes += bytes;
              current.guidances += 1;
            }
            break;
          }
          case 'FOLDER': {
            const bytes = bytesOf(item['templateRef']);
            if (bytes > 0) {
              current.bytes += bytes;
              current.templates += 1;
            }
            break;
          }
          default:
            break;
        }

        totals.set(subscriptionId, current);
      }

      startKey = page.LastEvaluatedKey;
    } while (startKey);

    return [...totals.entries()]
      .map(([subscriptionId, t]) => ({
        subscriptionId,
        storedBytes: t.bytes,
        notes: t.notes,
        guidances: t.guidances,
        templates: t.templates,
      }))
      .sort((left, right) => right.storedBytes - left.storedBytes);
  }

  /**
   * Writes what was measured, replacing the counter instead of adding to it.
   *
   * A write landing DURING the scan can be counted by the scan and applied by
   * the relay as well, and this Put then drops the relay's delta. The error is
   * bounded by what was written while the job ran and is corrected by the next
   * recount; the alternative, reconciling against a moving number, is not more
   * correct, only more elaborate. Run it when the account is quiet.
   */
  async apply(usage: readonly SubscriptionUsage[]): Promise<void> {
    for (const each of usage) {
      await this.deps.db.send(
        new PutCommand({
          TableName: this.deps.tableName,
          Item: {
            PK: `S#${each.subscriptionId}#VAULTS`,
            SK: 'USAGE',
            entity: 'USAGE',
            storedBytes: each.storedBytes,
            updatedAt: new Date().toISOString(),
            /** Says this number came from a recount and not from the relay. */
            recountedAt: new Date().toISOString(),
          },
        }),
      );
    }
  }
}
