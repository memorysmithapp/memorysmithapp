/**
 * The bytes of a file that nothing names (#377).
 *
 * Keeping a file writes its bytes first and its item second, on purpose
 * (ADR-008): a pointer to nothing is the one state that order cannot produce.
 * A failure between the two, a refused name or a function killed by its
 * timeout, leaves bytes under `f/` that no item names, which no page, tool,
 * quota or other job reaches. This finds them, by identifier and size only,
 * for the purge to destroy: it never reads what they hold.
 *
 * Only an object older than the safety age is chosen, so a keep in flight,
 * whose item is about to be written, is never touched.
 */

import { ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
import { ScanCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ContentId, SubscriptionId } from '@memorysmithapp/kernel';

/** How long a keep may be in flight; nothing younger is ever chosen. */
export const SAFETY_AGE_HOURS = 24;

export interface StoredObject {
  readonly key: string;
  readonly bytes: number;
  readonly lastModified: Date;
}

export interface UnnamedFile {
  readonly subscriptionId: string;
  readonly contentId: string;
  readonly bytes: number;
  readonly lastModified: string;
}

/** `s/{subscriptionId}/f/{contentId}`, the only shape a file's bytes take (INV-04). */
const FILE_KEY = /^s\/([^/]+)\/f\/([^/]+)$/;

/** The files among the stored objects that no item names and that are older than the cut. */
export function unnamedAmong(
  objects: readonly StoredObject[],
  named: ReadonlySet<string>,
  cutoff: Date,
): UnnamedFile[] {
  const found: UnnamedFile[] = [];
  for (const object of objects) {
    const match = FILE_KEY.exec(object.key);
    if (!match) continue;
    const [, subscriptionId = '', contentId = ''] = match;
    if (!SubscriptionId.fromClaim(subscriptionId).ok || !ContentId.create(contentId).ok) continue;
    if (named.has(`${subscriptionId}/${contentId}`)) continue;
    if (object.lastModified.getTime() > cutoff.getTime()) continue;
    found.push({
      subscriptionId,
      contentId,
      bytes: object.bytes,
      lastModified: object.lastModified.toISOString(),
    });
  }
  return found;
}

export interface UnnamedFilesDependencies {
  readonly db: DynamoDBDocumentClient;
  readonly tableName: string;
  readonly s3: S3Client;
  readonly bucket: string;
  readonly olderThanHours?: number;
  readonly now?: Date;
}

/** Every content a file item names, a deleted one's tombstone included: those go by their own job. */
async function namedContents(db: DynamoDBDocumentClient, tableName: string): Promise<Set<string>> {
  const named = new Set<string>();
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: 'entity = :file',
        ExpressionAttributeValues: { ':file': 'FILE' },
        ProjectionExpression: 'PK, contentRef',
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      }),
    );
    for (const item of page.Items ?? []) {
      const subscriptionId = /^S#([^#]+)#/.exec(String(item['PK'] ?? ''))?.[1];
      const contentId = (item['contentRef'] as { contentId?: unknown } | undefined)?.contentId;
      if (subscriptionId && typeof contentId === 'string') {
        named.add(`${subscriptionId}/${contentId}`);
      }
    }
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return named;
}

/**
 * The items are read before the bucket is listed: an object written after the
 * read is younger than the cut anyway, so a keep that completes meanwhile is
 * never mistaken for one that failed.
 */
export async function unnamedFiles(deps: UnnamedFilesDependencies): Promise<UnnamedFile[]> {
  const named = await namedContents(deps.db, deps.tableName);
  const objects: StoredObject[] = [];
  let token: string | undefined;
  do {
    const page = await deps.s3.send(
      new ListObjectsV2Command({
        Bucket: deps.bucket,
        Prefix: 's/',
        ...(token ? { ContinuationToken: token } : {}),
      }),
    );
    for (const object of page.Contents ?? []) {
      if (object.Key && object.LastModified) {
        objects.push({
          key: object.Key,
          bytes: object.Size ?? 0,
          lastModified: object.LastModified,
        });
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  const hours = deps.olderThanHours ?? SAFETY_AGE_HOURS;
  const cutoff = new Date((deps.now ?? new Date()).getTime() - hours * 3_600_000);
  return unnamedAmong(objects, named, cutoff);
}
