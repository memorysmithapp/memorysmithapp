/**
 * Entrypoint of the staging cleanup (#276).
 *
 * A fifth entrypoint on this bundle, next to `recount.ts` and `reproject.handler.ts`,
 * and for the same reason they are separate: an operator triggers it, not a
 * request or a stream. Run it with `pnpm tools data cleanup-staging`.
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
 * (INV-08).
 *
 * A run cut short — cancelled, or stopped on a workstation — never reaches its
 * own teardown, so its accounts stay with their notebooks (#436). An account
 * of the suite older than a day is such a run's: its notebooks are deleted as
 * above, then the account itself, as the teardown would have.
 *
 * And, in staging alone, a subscription the suite made goes once its owner is
 * gone and it holds no notebook, the purge having taken what it held (#436):
 * its items leave every table but the trail, which nothing alters (INV-06).
 * Nothing else in the product removes a subscription (INV-11), and this job
 * refuses every environment but staging.
 *
 * It refuses production by name, whatever credentials it runs under, and it
 * reports before it deletes, deleting only with `--apply`.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
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

/** How old an account of the suite is before it is a run cut short (#436). A run takes minutes. */
export const STALE_AFTER_HOURS = 24;

/**
 * What a subscription is to this job: a person's, never touched; a run in
 * progress, whose owner exists and is younger than a day; a run cut short,
 * whose owner exists and is older; or a leftover, whose owner is gone.
 */
export function kindOf(subscription: {
  readonly ownerEmail: string;
  readonly ownerExists: boolean;
  readonly requestedAt: Date;
  readonly now: Date;
}): 'person' | 'running' | 'stale' | 'leftover' {
  if (!subscription.ownerEmail.toLowerCase().endsWith(SUITE_DOMAIN)) return 'person';
  if (!subscription.ownerExists) return 'leftover';
  const hours = (subscription.now.getTime() - subscription.requestedAt.getTime()) / 3_600_000;
  return hours >= STALE_AFTER_HOURS ? 'stale' : 'running';
}

/**
 * Whether an item belongs to one of the subscriptions removed (#436): its
 * partition is the subscription, or starts with it, or it is the link of a
 * person to it. Read off the keys alone, as INV-01 lays them out.
 */
export function belongsTo(key: { PK: string; SK: string }, removed: ReadonlySet<string>): boolean {
  const own = /^S#([^#|]+)(?:[#|]|$)/.exec(key.PK);
  if (own) return removed.has(own[1] ?? '');
  if (key.PK.startsWith('USER#') && key.SK.startsWith('SUB#')) {
    return removed.has(key.SK.slice('SUB#'.length));
  }
  return false;
}

/** Deletes, in one scan of each table, every item of the subscriptions removed. */
async function removeSubscriptions(
  db: DynamoDBDocumentClient,
  tables: readonly string[],
  removed: ReadonlySet<string>,
): Promise<number> {
  let items = 0;
  for (const table of tables) {
    const keys: Array<{ PK: string; SK: string }> = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await db.send(
        new ScanCommand({
          TableName: table,
          ProjectionExpression: 'PK, SK',
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      for (const item of page.Items ?? []) {
        const key = { PK: String(item['PK'] ?? ''), SK: String(item['SK'] ?? '') };
        if (belongsTo(key, removed)) keys.push(key);
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    for (let at = 0; at < keys.length; at += 25) {
      let pending: Array<{ DeleteRequest: { Key: Record<string, unknown> } }> = keys
        .slice(at, at + 25)
        .map((key) => ({ DeleteRequest: { Key: key } }));
      while (pending.length > 0) {
        const answer = await db.send(new BatchWriteCommand({ RequestItems: { [table]: pending } }));
        pending = (answer.UnprocessedItems?.[table] ?? []) as typeof pending;
      }
    }
    items += keys.length;
  }
  return items;
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
  /** A run cut short, whose account goes after its notebooks (#436). */
  readonly stale: boolean;
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
    // The other tables are read only to remove a subscription (#436), and
    // the trail is never one of them (INV-06).
    auditTable: '',
    discoveryTable: required('DISCOVERY_TABLE'),
    portabilityTable: required('PORTABILITY_TABLE'),
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
  const empty = new Set<string>();
  let alive = 0;
  const now = new Date();
  await inParallel(suite, 8, async (view) => {
    const id = SubscriptionId.fromClaim(view.subscriptionId);
    if (!id.ok) return;
    const subscription = await platform.findById(id.value);
    if (!subscription) return;

    const email = Email.create(view.ownerEmail);
    const holder = email.ok ? await accounts.userIdOf(email.value) : null;
    const ownerExists = holder?.equals(subscription.ownerId) ?? false;
    const kind = kindOf({
      ownerEmail: view.ownerEmail,
      ownerExists,
      requestedAt: new Date(subscription.requestedAt.toISOString()),
      now,
    });
    if (kind === 'person' || kind === 'running') {
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
    // A leftover holding nothing, the purge done, is a subscription to remove.
    if (notebooks.length === 0 && kind === 'leftover') {
      empty.add(view.subscriptionId);
      return;
    }
    leftovers.push({
      subscriptionId: view.subscriptionId,
      ownerEmail: view.ownerEmail,
      context: context.value,
      owner: subscription.ownerId,
      notebooks: notebooks.length,
      notes: usage.subscription.noteCount,
      bytes:
        usage.subscription.noteBytes + usage.subscription.fileBytes + usage.subscription.otherBytes,
      stale: kind === 'stale',
    });
  });
  const stale = leftovers.filter((each) => each.stale);

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
      `${alive} of them runs younger than ${STALE_AFTER_HOURS} hours (left alone).`,
  );
  console.log(
    `${stale.length} account(s) of runs cut short, older than ${STALE_AFTER_HOURS} hours, ` +
      'go with their notebooks.',
  );
  console.log(
    `${leftovers.length} subscription(s) hold ${total.notebooks} notebook(s), ` +
      `${total.notes} note(s) and ${human(total.bytes)} to delete.`,
  );
  console.log(
    `${empty.size} empty subscription(s) whose owner is gone are removed, in staging only.`,
  );

  if (!write) {
    console.log('\nDry run: nothing was deleted. Pass --apply to delete them.');
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
        // there is no anonymous mutation (INV-07), and nobody else may.
        by: Authorship.byHuman(leftover.owner),
      });
      if (done.ok) deleted += 1;
      else failures.push(`${leftover.subscriptionId} ${notebook.id.value}: ${done.error.message}`);
    }
  });

  // The accounts of runs cut short go after their notebooks, as the
  // teardown would have taken them (#436); their subscriptions are removed
  // by a later run, once the purge has taken what they held.
  const cognito = new CognitoIdentityProviderClient({});
  let accountsGone = 0;
  for (const each of stale) {
    try {
      await cognito.send(
        new AdminDeleteUserCommand({
          UserPoolId: required('USER_POOL_ID'),
          Username: each.ownerEmail,
        }),
      );
      accountsGone += 1;
    } catch (error) {
      if ((error as { name?: string }).name === 'UserNotFoundException') continue;
      failures.push(
        `${each.ownerEmail}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const items = await removeSubscriptions(
    infra.db,
    [infra.accessTable, infra.knowledgeTable, infra.portabilityTable, infra.discoveryTable],
    empty,
  );

  for (const failure of failures) console.error(`  not deleted: ${failure}`);
  console.log(
    `\nDeleted ${deleted} notebook(s) of ${leftovers.length} subscription(s); ` +
      'the purge destroys what they held in the background.',
  );
  console.log(`Deleted ${accountsGone} account(s) of runs cut short.`);
  console.log(`Removed ${empty.size} empty subscription(s), ${items} item(s).`);
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
