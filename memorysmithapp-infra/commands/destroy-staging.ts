/**
 * Tears staging down, leaving nothing of it but its hosted zone.
 *
 *   pnpm -C memorysmithapp-infra destroy-staging [--preview]
 *
 * It runs from a workstation, with the credentials of whoever tears staging
 * down: it only calls AWS, so it asks nothing of the machine but to stay awake,
 * and no role GitHub assumes may delete anything. It refuses production before it looks at a
 * credential, and any account but the one cdk.json names for staging after.
 * Production lives in that same account, which is why it deletes only what the
 * stacks of staging list, and why its role may delete a user pool only when the
 * pool is tagged staging.
 *
 * What it does, in order, is `lib/teardown-run.ts`, which an installation of
 * somebody else is torn down by too (#391): the stacks in the reverse of a
 * delivery, then what no removal policy deletes.
 *
 * The hosted zone is never touched: its name servers were drawn when it was
 * created, and the delegation in production names them. The roles GitHub
 * delivers with are never touched either: they belong to the account.
 */

import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { parseArgs } from 'node:util';
import { readText } from './lib/repository.js';
import { describeRetained, refusalOf, teardownOrder } from './lib/teardown.js';
import { deleteStacks, purge, survey } from './lib/teardown-run.js';

const { values } = parseArgs({
  options: {
    environment: { type: 'string', default: process.env['ENVIRONMENT'] ?? 'staging' },
    preview: { type: 'boolean', default: false },
  },
});

const say = (line: string): void => void process.stdout.write(`${line}\n`);

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

// ---- Who asks, and for what --------------------------------------------------

const environment = values.environment;
const declared = (
  JSON.parse(readText('memorysmithapp-infra/cdk.json')) as {
    context: { environments: Record<string, { account?: string; region?: string } | undefined> };
  }
).context.environments[environment];

const early = refusalOf({
  environment,
  callerAccount: null,
  environmentAccount: declared?.account,
});
if (early) refuse(early);

const region = declared?.region ?? 'us-east-1';
const caller = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
const refusal = refusalOf({
  environment,
  callerAccount: caller.Account ?? '',
  environmentAccount: declared?.account,
});
if (refusal) refuse(refusal);

say(`Tearing down ${environment}, account ${caller.Account}, ${region}.`);

// ---- What goes ---------------------------------------------------------------

say('\nStacks');
const { present, retained } = await survey(
  teardownOrder(environment).map((stack) => ({ stack, region })),
  say,
);

say('\nPurged after the stacks are gone');
for (const each of retained) say(`  ${describeRetained(each.retained)}`);
if (retained.length === 0) say('  nothing any stack retains');
say('  the log groups of functions that no longer exist');
say('\nKept: the hosted zone and the roles GitHub delivers with.');

if (values.preview) {
  say('\nPreview: nothing was deleted.');
  process.exit(0);
}

say('\nDeleting');
const stopped = await deleteStacks(present, say);
if (stopped) refuse(stopped);

say('\nPurging');
const failures = await purge({ retained, environment, regions: [region], say });
if (failures > 0) {
  refuse(`\nThe stacks are gone, and ${failures} resource(s) above are still standing.`);
}
say(`\n${environment} is gone. Its hosted zone stays, and the next delivery raises it.`);
