/**
 * The deletion of the versions notebook models had before #431, which the
 * function `forget-model-versions.handler.ts` runs in AWS (#434), started by
 * `pnpm tools data forget-model-versions` in staging and by the workflow of
 * production maintenance.
 *
 * A model keeps no copy of its notebook any more: it is read where it is, and
 * what changed in it is the history of its notebook. The versions it froze
 * before were kept exports of its owner, counted in the storage of the
 * subscription, and nothing reads them now. This finds every one of them —
 * an export whose record carries what a version froze — and deletes it as its
 * owner deleting it would: its bytes by the exact revision written, its record,
 * and what it occupied (RN-PRT-020). The catalog entries are said again
 * without the versions they listed.
 *
 * It reports before it writes, and only `--apply` deletes. A second run finds
 * nothing left, so a run that was interrupted is simply run again.
 */

import { ScanCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DeleteTransfer } from '@memorysmithapp/svc-portability/application/transfers';
import { DynamoTransferStore } from '@memorysmithapp/svc-portability/adapters/dynamo';
import { DynamoCatalogStore } from '@memorysmithapp/svc-portability/adapters/catalog';
import type { S3ArchiveStore } from '@memorysmithapp/svc-portability/adapters/s3';

/** A transfer record is `S#{subscription}#USER#{user}` / `TRANSFER#{id}`. */
const TRANSFER_KEY = /^S#([^#]+)#USER#(.+)$/;

/** A version kept before #431, as its record names it. */
export interface KeptVersion {
  readonly subscriptionId: string;
  readonly userId: string;
  readonly transferId: string;
  readonly bytes: number;
}

/** The versions of every model, read off the portability table. */
export async function keptVersions(
  db: DynamoDBDocumentClient,
  tableName: string,
): Promise<KeptVersion[]> {
  const found: KeptVersion[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: 'entity = :transfer AND attribute_exists(#model)',
        ProjectionExpression: 'PK, SK, #bytes',
        ExpressionAttributeNames: { '#model': 'model', '#bytes': 'bytes' },
        ExpressionAttributeValues: { ':transfer': 'TRANSFER' },
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      }),
    );
    for (const item of page.Items ?? []) {
      const owner = TRANSFER_KEY.exec(String(item['PK'] ?? ''));
      const sortKey = String(item['SK'] ?? '');
      if (!owner || !sortKey.startsWith('TRANSFER#')) continue;
      found.push({
        subscriptionId: owner[1] ?? '',
        userId: owner[2] ?? '',
        transferId: sortKey.slice('TRANSFER#'.length),
        bytes: Number(item['bytes'] ?? 0),
      });
    }
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return found;
}

/** What a run found, and what it deleted when it was asked to apply. */
export interface ForgetSummary {
  readonly mode: 'report' | 'apply';
  readonly versions: number;
  readonly subscriptions: number;
  readonly bytes: number;
  readonly catalogEntries: number;
  readonly deleted: number;
  /** Each version that could not be deleted, and why. */
  readonly failures: readonly string[];
}

/**
 * Finds the versions, and with `apply` deletes each one as its owner deleting
 * it would and says every catalog entry again: the bytes by the exact revision
 * written, the record, and what it occupied (RN-PRT-020).
 */
export async function forgetModelVersions(input: {
  readonly db: DynamoDBDocumentClient;
  readonly tableName: string;
  readonly archives: S3ArchiveStore;
  readonly apply: boolean;
}): Promise<ForgetSummary> {
  const versions = await keptVersions(input.db, input.tableName);
  const catalog = new DynamoCatalogStore(input.db, input.tableName);
  const entries = await catalog.list();
  const failures: string[] = [];
  let deleted = 0;
  if (input.apply) {
    for (const version of versions) {
      const done = await new DeleteTransfer(
        new DynamoTransferStore(input.db, input.tableName, version.subscriptionId),
        input.archives,
        version.userId,
      ).execute(version.transferId);
      if (done.ok) deleted += 1;
      else failures.push(`${version.transferId}: ${done.error.message}`);
    }
    // Read as an entry is read now and written back whole, which drops what it listed.
    for (const entry of entries) await catalog.put(entry);
  }
  return {
    mode: input.apply ? 'apply' : 'report',
    versions: versions.length,
    subscriptions: new Set(versions.map((version) => version.subscriptionId)).size,
    bytes: versions.reduce((total, version) => total + version.bytes, 0),
    catalogEntries: entries.length,
    deleted,
    failures,
  };
}
