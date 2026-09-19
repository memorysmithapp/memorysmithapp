/**
 * Entrypoint of the slot migration (#159).
 *
 * A fourth entrypoint on the same bundle, beside the request handler, the
 * outbox relay and the recount, and for the same reason: it is triggered by an
 * operator, it serves no request and it needs no session. Run it with
 * `pnpm -C memorysmith-infra migrate-slots --environment staging [--apply]`.
 *
 * It reports before it writes, and writes only when told to, because a job
 * that changes where a person's Guidance lives is not a job anybody should
 * discover afterwards.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SlotMigration } from '@memorysmith/svc-knowledge/adapters/slot-migration';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function main(argv: readonly string[]): Promise<number> {
  const apply = argv.includes('--apply');
  const migration = new SlotMigration({
    db: DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
    tableName: required('KNOWLEDGE_TABLE'),
  });

  const report = await migration.run({ apply });

  console.log(`Notebooks walked:            ${report.notebooks}`);
  console.log(`Guidances of the old shape:  ${report.guidances}`);
  console.log(`Templates of the old shape:  ${report.templates}`);
  console.log(`Already in the new shape:    ${report.alreadyMigrated}`);

  if (report.guidances === 0 && report.templates === 0) {
    console.log('\nNothing to migrate: every Guidance and every Template has a life of its own.');
    return 0;
  }

  if (!apply) {
    console.log('\nDry run: nothing was written. Pass --apply to migrate these slots.');
    return 0;
  }

  console.log(`\nWrote ${report.written} slot(s). Not one byte of content was read or written.`);
  return 0;
}

if (process.argv[1]?.endsWith('migrate-slots.ts')) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
