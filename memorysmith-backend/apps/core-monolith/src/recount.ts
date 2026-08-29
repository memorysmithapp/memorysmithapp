/**
 * Entrypoint of the storage recount (RN-SUB-021).
 *
 * A third entrypoint on the same bundle, next to the request handler and the
 * outbox relay, and for the same reason they are separate: it is triggered by
 * an operator rather than by a request or a stream, and it needs no session at
 * all. Run it with `deploy-aws/recount-storage.ps1`.
 *
 * It reports before it writes, and writes only when told to, because a job
 * that silently replaces a number nobody looked at is how a wrong number
 * becomes the new truth.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { StorageRecount } from '@memorysmith/svc-knowledge/adapters/recount';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** Bytes as a person reads them, for the report only. */
function human(bytes: number): string {
  const units = ['bytes', 'kB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

export async function main(argv: readonly string[]): Promise<number> {
  const write = argv.includes('--apply');
  const recount = new StorageRecount({
    db: DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
    tableName: required('KNOWLEDGE_TABLE'),
  });

  const usage = await recount.measure();
  if (usage.length === 0) {
    console.log('No subscription holds any content yet: nothing to count.');
    return 0;
  }

  for (const each of usage) {
    console.log(
      `  ${each.subscriptionId}  ${human(each.storedBytes).padStart(10)}  ` +
        `(${each.notes} notes, ${each.guidances} guidance, ${each.templates} templates)`,
    );
  }

  if (!write) {
    console.log('\nDry run: nothing was written. Pass --apply to store these numbers.');
    return 0;
  }

  await recount.apply(usage);
  console.log(`\nWrote the counter of ${usage.length} subscription(s).`);
  return 0;
}

const invokedDirectly = process.argv[1]?.endsWith('recount.ts') === true;
if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
