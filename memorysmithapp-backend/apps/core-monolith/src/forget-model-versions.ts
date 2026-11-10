/**
 * Entrypoint of the deletion of the versions notebook models had before #431.
 * Run it with `pnpm tools data forget-model-versions`.
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

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { DeleteTransfer } from '@memorysmithapp/svc-portability/application/transfers';
import { DynamoTransferStore } from '@memorysmithapp/svc-portability/adapters/dynamo';
import { DynamoCatalogStore } from '@memorysmithapp/svc-portability/adapters/catalog';
import { S3ArchiveStore } from '@memorysmithapp/svc-portability/adapters/s3';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

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

export async function main(argv: readonly string[]): Promise<number> {
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const tableName = required('PORTABILITY_TABLE');
  const archives = new S3ArchiveStore(new S3Client({}), required('CONTENT_BUCKET'));

  const versions = await keptVersions(db, tableName);
  const bytes = versions.reduce((total, version) => total + version.bytes, 0);
  const subscriptions = new Set(versions.map((version) => version.subscriptionId)).size;
  console.log(
    `${versions.length} versions of models, in ${subscriptions} subscriptions, hold ${bytes} bytes.`,
  );
  const catalog = new DynamoCatalogStore(db, tableName);
  const entries = await catalog.list();
  console.log(`${entries.length} catalog entries are said again without versions.`);
  if (!argv.includes('--apply')) return 0;

  let deleted = 0;
  for (const version of versions) {
    const done = await new DeleteTransfer(
      new DynamoTransferStore(db, tableName, version.subscriptionId),
      archives,
      version.userId,
    ).execute(version.transferId);
    if (done.ok) deleted += 1;
    else console.error(`${version.transferId}: ${done.error.message}`);
  }
  // Read as an entry is read now and written back whole, which drops what it listed.
  for (const entry of entries) await catalog.put(entry);
  console.log(`${deleted} versions deleted, ${entries.length} catalog entries said again.`);
  return deleted === versions.length ? 0 : 1;
}

const invokedDirectly = process.argv[1]?.endsWith('forget-model-versions.ts') === true;
if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
