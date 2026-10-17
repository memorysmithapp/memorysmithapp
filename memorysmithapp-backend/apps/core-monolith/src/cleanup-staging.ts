/**
 * Entrypoint of the staging cleanup (#276).
 *
 * A fifth entrypoint on this bundle, next to `recount.ts` and `reproject.handler.ts`,
 * and for the same reason they are separate: an operator triggers it, not a
 * request or a stream. Run it with `pnpm -C memorysmithapp-infra cleanup-staging`.
 *
 * The functional suite deleted the accounts of every run and left their
 * notebooks behind, so staging came to hold thousands of notebooks nobody can
 * open, and every job that scans the environment paid for them. This deletes
 * the notebooks of a subscription the suite made — its owner is an
 * `@example.com` account — and whose owner no longer exists in the pool.
 *
 * It deletes by the use case the API runs, as the owner of the subscription,
 * never by deleting items: the deletion is definitive and the purge takes the
 * content, the items, the projections and the files, as it does for a person
 * (rule 8). The subscriptions stay, because nothing in the product deletes one.
 *
 * It refuses production by name, whatever credentials it runs under, and it
 * reports before it deletes, deleting only with `--apply`.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import {
  Authorship,
  SubscriptionContext,
  SubscriptionId,
  SubscriptionStatus,
  type UserId,
} from '@memorysmithapp/kernel';
import { CognitoAccountDirectory } from '@memorysmithapp/svc-access/adapters/cognito';
import { ResolveRequestContext } from '@memorysmithapp/svc-access/application/context';
import { Email } from '@memorysmithapp/svc-access/domain/values';
import { DynamoStorageMeter } from '@memorysmithapp/svc-knowledge/adapters/storage';
import {
  buildAccess,
  buildKnowledge,
  buildShares,
  type Infrastructure,
} from './composition-root.js';
import { DeleteNotebookAndShares } from './shares.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** The domain every account of the functional suite is made under. */
export const SUITE_DOMAIN = '@example.com';

/** Why this job may not run in an environment, or null. */
export function environmentRefusal(environment: string): string | null {
  return environment === 'staging'
    ? null
    : `The cleanup deletes notebooks, and runs on staging only; this is ${environment}. Nothing ran.`;
}

/**
 * Whether a subscription is a leftover of the suite: its owner was made by the
 * suite and is gone. An owner that still exists is a run in progress, or a
 * person, and either way not this job's to touch.
 */
export function isLeftover(subscription: {
  readonly ownerEmail: string;
  readonly ownerExists: boolean;
}): boolean {
  return subscription.ownerEmail.toLowerCase().endsWith(SUITE_DOMAIN) && !subscription.ownerExists;
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

/** Runs `work` over `items`, at most `width` at a time. */
async function inParallel<T>(
  items: readonly T[],
  width: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(width, items.length) }, async () => {
      while (next < items.length) await work(items[next++]!);
    }),
  );
}

interface Leftover {
  readonly subscriptionId: string;
  readonly ownerEmail: string;
  readonly context: SubscriptionContext;
  readonly owner: UserId;
  readonly notebooks: number;
  readonly notes: number;
  readonly bytes: number;
}

export async function main(argv: readonly string[]): Promise<number> {
  const refusal = environmentRefusal(required('ENVIRONMENT'));
  if (refusal) {
    console.error(refusal);
    return 1;
  }
  const write = argv.includes('--apply');

  const infra: Infrastructure = {
    db: DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
    s3: new S3Client({}),
    knowledgeTable: required('KNOWLEDGE_TABLE'),
    accessTable: required('ACCESS_TABLE'),
    // A deletion writes the notebook and its outbox, and nothing else: the
    // purge and the projections follow from the event, in the environment.
    auditTable: '',
    discoveryTable: '',
    portabilityTable: '',
    contentBucket: required('CONTENT_BUCKET'),
  };
  const accounts = new CognitoAccountDirectory(required('USER_POOL_ID'), '');
  const { platform } = buildAccess(infra, null);

  const listed = (
    await Promise.all(
      [
        SubscriptionStatus.PENDING_APPROVAL,
        SubscriptionStatus.TRIAL,
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.REJECTED,
        SubscriptionStatus.SUSPENDED,
        SubscriptionStatus.CANCELED,
      ].map((status) => platform.listByStatus(status)),
    )
  ).flat();
  const suite = listed.filter((each) => each.ownerEmail.toLowerCase().endsWith(SUITE_DOMAIN));

  const leftovers: Leftover[] = [];
  let alive = 0;
  await inParallel(suite, 8, async (view) => {
    const id = SubscriptionId.fromClaim(view.subscriptionId);
    if (!id.ok) return;
    const subscription = await platform.findById(id.value);
    if (!subscription) return;

    const email = Email.create(view.ownerEmail);
    const holder = email.ok ? await accounts.userIdOf(email.value) : null;
    const ownerExists = holder?.equals(subscription.ownerId) ?? false;
    if (!isLeftover({ ownerEmail: view.ownerEmail, ownerExists })) {
      alive += 1;
      return;
    }

    const context = SubscriptionContext.fromClaims({
      sub: subscription.ownerId.value,
      subscription_id: view.subscriptionId,
      subscription_status: subscription.status.name,
    });
    if (!context.ok) return;
    const usage = await new DynamoStorageMeter(
      context.value,
      infra.db,
      infra.knowledgeTable,
    ).read();
    const notebooks = await buildKnowledge(infra, context.value).notebooks.listAll();
    if (notebooks.length === 0) return;
    leftovers.push({
      subscriptionId: view.subscriptionId,
      ownerEmail: view.ownerEmail,
      context: context.value,
      owner: subscription.ownerId,
      notebooks: notebooks.length,
      notes: usage.subscription.noteCount,
      bytes:
        usage.subscription.noteBytes + usage.subscription.fileBytes + usage.subscription.otherBytes,
    });
  });

  const total = leftovers.reduce(
    (sum, each) => ({
      notebooks: sum.notebooks + each.notebooks,
      notes: sum.notes + each.notes,
      bytes: sum.bytes + each.bytes,
    }),
    { notebooks: 0, notes: 0, bytes: 0 },
  );
  console.log(
    `${listed.length} subscription(s) in all, ${suite.length} made by the suite, ` +
      `${alive} of them with an owner who still exists (left alone).`,
  );
  console.log(
    `${leftovers.length} subscription(s) whose owner is gone hold ${total.notebooks} notebook(s), ` +
      `${total.notes} note(s) and ${human(total.bytes)}.`,
  );

  if (!write) {
    console.log('\nDry run: nothing was deleted. Pass --apply to delete these notebooks.');
    return 0;
  }

  const sharing = buildShares(infra);
  let deleted = 0;
  const failures: string[] = [];
  await inParallel(leftovers, 8, async (leftover) => {
    const { scoped } = buildAccess(infra, leftover.context);
    if (!scoped) return;
    const ctx = await new ResolveRequestContext(scoped.subscriptions).execute(leftover.context);
    if (!ctx.ok) {
      failures.push(`${leftover.subscriptionId}: ${ctx.error.message}`);
      return;
    }
    const knowledge = buildKnowledge(infra, leftover.context);
    const deletion = new DeleteNotebookAndShares(knowledge, leftover.context, sharing.shares);
    for (const notebook of await knowledge.notebooks.listAll()) {
      const done = await deletion.execute({
        ctx: ctx.value,
        notebookId: notebook.id,
        // The owner of the subscription, as if they had deleted it themselves:
        // there is no anonymous mutation (rule 7), and nobody else may.
        by: Authorship.byHuman(leftover.owner),
      });
      if (done.ok) deleted += 1;
      else failures.push(`${leftover.subscriptionId} ${notebook.id.value}: ${done.error.message}`);
    }
  });

  for (const failure of failures) console.error(`  not deleted: ${failure}`);
  console.log(
    `\nDeleted ${deleted} notebook(s) of ${leftovers.length} subscription(s); ` +
      'the purge destroys what they held in the background.',
  );
  return failures.length > 0 ? 2 : 0;
}

const invokedDirectly = process.argv[1]?.endsWith('cleanup-staging.ts') === true;
if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
