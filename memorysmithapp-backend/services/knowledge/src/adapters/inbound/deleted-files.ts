/**
 * The files deleted on their own that the purge never heard of (#372).
 *
 * The rule in front of the purge did not route `FileDeleted`, so such a file
 * stayed a tombstone with its bytes in the bucket. A file now reaches the purge
 * by itself, and what was deleted before that is found here, by the tombstones.
 *
 * This only reads. Destroying content is the purge's alone (INV-08), and the
 * bytes left the counters at the deletion, so what it answers is the envelope
 * that deletion would have delivered, for the purge to take.
 *
 * A Scan, deliberately, for the reason the recount gives: no index lists the
 * subscriptions, and this job runs by hand.
 */

import { ScanCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { DeletionEnvelope } from './content-purge.js';

const SUBSCRIPTION_OF_KEY = /^S#([^#]+)#NOTEBOOK#/;

export interface DeletedFilesDependencies {
  readonly db: DynamoDBDocumentClient;
  readonly tableName: string;
}

/** One envelope of `FileDeleted` for every tombstone of a file. */
export async function deletedFiles(deps: DeletedFilesDependencies): Promise<DeletionEnvelope[]> {
  const found: DeletionEnvelope[] = [];
  let startKey: Record<string, unknown> | undefined;

  do {
    const page = await deps.db.send(
      new ScanCommand({
        TableName: deps.tableName,
        FilterExpression: 'entity = :file AND attribute_exists(deletedAt)',
        ExpressionAttributeValues: { ':file': 'FILE' },
        ProjectionExpression: 'PK, fileId, notebookId, contentRef, updatedBy',
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      }),
    );

    for (const item of page.Items ?? []) {
      const subscriptionId = SUBSCRIPTION_OF_KEY.exec(String(item['PK'] ?? ''))?.[1];
      if (!subscriptionId) continue;
      found.push({
        type: 'FileDeleted',
        subscriptionId,
        authorship: item['updatedBy'],
        contentRef: item['contentRef'],
        payload: { notebookId: item['notebookId'], fileId: item['fileId'] },
      });
    }
    startKey = page.LastEvaluatedKey;
  } while (startKey);

  return found;
}
