/**
 * Entrypoint of the storage recount (RN-SUB-021, RN-SUB-024).
 *
 * A third entrypoint on the same bundle, next to the request handler and the
 * outbox relay, and for the same reason they are separate: it is triggered by
 * an operator rather than by a request or a stream, and it needs no session at
 * all. Run it with `pnpm -C memorysmith-infra recount-storage`.
 *
 * It recounts the counters of three contexts at once, and this is where they
 * meet, because none of them may read the table of another: the content and
 * what fills it come from Knowledge, the revisions from the trail of Audit,
 * which names every one of them, and the kept exports from Portability.
 *
 * It reports before it writes, and writes only when told to, because a job
 * that silently replaces a number nobody looked at is how a wrong number
 * becomes the new truth.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { StorageRecount } from '@memorysmith/svc-knowledge/adapters/recount';
import { DynamoRevisionCensus } from '@memorysmith/svc-audit/adapters/census';
import { KeptRecount } from '@memorysmith/svc-portability/adapters/dynamo';

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
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const census = new DynamoRevisionCensus(db, required('AUDIT_TABLE'));
  const recount = new StorageRecount({
    db,
    tableName: required('KNOWLEDGE_TABLE'),
    revisions: () => census.count(),
  });
  const kept = new KeptRecount(db, required('PORTABILITY_TABLE'));

  const [usage, exports] = await Promise.all([recount.measure(), kept.measure()]);
  if (usage.length === 0 && exports.length === 0) {
    console.log('No subscription holds any content yet: nothing to count.');
    return 0;
  }

  for (const each of usage) {
    console.log(
      `  ${each.subscriptionId}  ${human(each.storedBytes).padStart(10)}  ` +
        `(${each.notes} notes, ${each.files} files, ${each.guidances} guidance, ` +
        `${each.templates} templates; ${each.notebooks} notebooks, ${each.folders} folders, ` +
        `${each.revisions ?? 'uncounted'} revisions)`,
    );
  }
  /**
   * Files a deleted notebook left behind before its purge took files with it
   * (#202). They are counted in nothing above, and nothing here destroys them:
   * destroying content is the purge's alone (rule 8), so this says what the
   * store still holds for nobody, and a person decides.
   */
  const orphans = usage.flatMap((each) =>
    each.orphanFiles.map((orphan) => ({ subscriptionId: each.subscriptionId, ...orphan })),
  );
  if (orphans.length > 0) {
    console.log('\nFiles of notebooks that no longer exist (not counted, not destroyed):');
    for (const orphan of orphans) {
      console.log(
        `  ${orphan.subscriptionId}  notebook ${orphan.notebookId}  ` +
          `${human(orphan.bytes).padStart(10)}  (${orphan.files} files)`,
      );
    }
  }
  for (const each of exports) {
    console.log(
      `  ${each.subscriptionId}  ${human(each.bytes).padStart(10)}  (${each.count} kept exports)`,
    );
  }

  if (!write) {
    console.log('\nDry run: nothing was written. Pass --apply to store these numbers.');
    return 0;
  }

  await recount.apply(usage);
  await kept.apply(exports);
  console.log(
    `\nWrote the counters of ${usage.length} subscription(s), ` +
      `and the kept exports of ${exports.length}.`,
  );
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
