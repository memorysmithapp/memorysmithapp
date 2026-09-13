/**
 * Tears staging down, leaving nothing of it but its hosted zone and its
 * pipeline (architecture-guide.md, section 20).
 *
 *   pnpm -C memorysmith-infra destroy-staging [--preview]
 *
 * It runs in the DestroyStaging project of the staging account, started by
 * `pnpm staging:destroy`, because a teardown outlasts any workstation that
 * should stay awake for it. It refuses production before it looks at a
 * credential, and any account but the one cdk.json names for staging after.
 *
 * In order:
 * 1. what the stacks retain is listed before they go, because afterwards
 *    nothing says which table or bucket was theirs;
 * 2. an operation already running on a stack is joined, not raced;
 * 3. the stacks are deleted one at a time, in the reverse of a delivery.
 *    Deleting the sign-in domain alone takes over half an hour;
 * 4. what no removal policy deletes is purged: the tables, the audit trail
 *    included, the content bucket with every version, the user pool, and the
 *    log groups of functions that are gone.
 *
 * The hosted zone is never touched: its name servers were drawn when it was
 * created, and the delegation in production names them. The pipeline stack is
 * never touched either: it is what runs this.
 */

import {
  CloudFormationClient,
  DeleteStackCommand,
  DescribeStacksCommand,
  paginateListStackResources,
} from '@aws-sdk/client-cloudformation';
import {
  CloudWatchLogsClient,
  DeleteLogGroupCommand,
  paginateDescribeLogGroups,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  CognitoIdentityProviderClient,
  DeleteUserPoolCommand,
  DeleteUserPoolDomainCommand,
  DescribeUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaClient, paginateListFunctions } from '@aws-sdk/client-lambda';
import {
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectVersionsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { readText } from './lib/repository.js';
import {
  chunks,
  describeRetained,
  orphanLogGroups,
  refusalOf,
  retainedOf,
  stackIdOf,
  teardownOrder,
  type Retained,
  type StackResource,
} from './lib/teardown.js';

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

const nameOf = (error: unknown): unknown => (error as { name?: unknown }).name;
const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// ---- Who asks, and for what --------------------------------------------------

const environment = values.environment;
const declared = (
  JSON.parse(readText('memorysmith-infra/cdk.json')) as {
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

const cloudformation = new CloudFormationClient({ region });
const dynamodb = new DynamoDBClient({ region });
const s3 = new S3Client({ region });
const cognito = new CognitoIdentityProviderClient({ region });
const logs = new CloudWatchLogsClient({ region });
const lambda = new LambdaClient({ region });

say(`Tearing down ${environment}, account ${caller.Account}, ${region}.`);

// ---- Stacks ------------------------------------------------------------------

interface StackState {
  readonly status: string;
  readonly reason: string | undefined;
}

async function stateOf(stack: string): Promise<StackState | null> {
  try {
    const described = (await cloudformation.send(new DescribeStacksCommand({ StackName: stack })))
      .Stacks?.[0];
    return described?.StackStatus
      ? { status: described.StackStatus, reason: described.StackStatusReason }
      : null;
  } catch (error) {
    if (messageOf(error).includes('does not exist')) return null;
    throw error;
  }
}

/** Waits until nothing is in flight on the stack, and answers null once it is gone. */
async function settled(stack: string): Promise<StackState | null> {
  const deadline = Date.now() + 90 * 60_000;
  for (;;) {
    const state = await stateOf(stack);
    if (state === null || !state.status.endsWith('_IN_PROGRESS')) return state;
    if (Date.now() > deadline) {
      throw new Error(`${stack} is still ${state.status} after 90 minutes.`);
    }
    await sleep(20_000);
  }
}

say('\nStacks');
const present: string[] = [];
const retained: Retained[] = [];
for (const stack of teardownOrder(environment)) {
  const state = await stateOf(stack);
  if (state === null) {
    say(`  ${stack.padEnd(40)} not deployed`);
    continue;
  }
  say(`  ${stack.padEnd(40)} ${state.status}`);
  present.push(stack);
  const resources: StackResource[] = [];
  for await (const page of paginateListStackResources(
    { client: cloudformation },
    { StackName: stack },
  )) {
    for (const summary of page.StackResourceSummaries ?? []) {
      resources.push({
        type: summary.ResourceType ?? '',
        physicalId: summary.PhysicalResourceId ?? '',
      });
    }
  }
  retained.push(...retainedOf(resources));
}

say('\nPurged after the stacks are gone');
for (const each of retained) say(`  ${describeRetained(each)}`);
if (retained.length === 0) say('  nothing any stack retains');
say('  the log groups of functions that no longer exist');
say('\nKept: the hosted zone and the pipeline stack.');

if (values.preview) {
  say('\nPreview: nothing was deleted.');
  process.exit(0);
}

say('\nDeleting');
for (const stack of present) {
  const before = await settled(stack);
  if (before === null) {
    say(`  ${stack.padEnd(40)} gone, by the operation that was already running`);
    continue;
  }
  await cloudformation.send(new DeleteStackCommand({ StackName: stack }));
  const after = await settled(stack);
  if (after !== null) {
    // The stacks before it in the list depend on it: deleting on would only
    // pile failures on top of this one.
    refuse(`  ${stack} ended ${after.status}: ${after.reason ?? 'CloudFormation gave no reason'}.`);
  }
  say(`  ${stack.padEnd(40)} deleted`);
}

// ---- What no removal policy deletes -----------------------------------------

async function purgeTable(name: string): Promise<string> {
  try {
    await dynamodb.send(new DeleteTableCommand({ TableName: name }));
    return 'deleted';
  } catch (error) {
    if (nameOf(error) === 'ResourceNotFoundException') return 'already gone';
    throw error;
  }
}

async function purgeBucket(name: string): Promise<string> {
  try {
    let removed = 0;
    let keyMarker: string | undefined;
    let versionMarker: string | undefined;
    let truncated = false;
    do {
      const page = await s3.send(
        new ListObjectVersionsCommand({
          Bucket: name,
          ...(keyMarker ? { KeyMarker: keyMarker } : {}),
          ...(versionMarker ? { VersionIdMarker: versionMarker } : {}),
        }),
      );
      const objects = [...(page.Versions ?? []), ...(page.DeleteMarkers ?? [])].map((entry) => ({
        Key: entry.Key ?? '',
        ...(entry.VersionId ? { VersionId: entry.VersionId } : {}),
      }));
      for (const batch of chunks(objects)) {
        await s3.send(
          new DeleteObjectsCommand({ Bucket: name, Delete: { Objects: batch, Quiet: true } }),
        );
        removed += batch.length;
      }
      truncated = page.IsTruncated === true;
      keyMarker = page.NextKeyMarker;
      versionMarker = page.NextVersionIdMarker;
    } while (truncated);
    await s3.send(new DeleteBucketCommand({ Bucket: name }));
    return `emptied of ${removed} version(s) and deleted`;
  } catch (error) {
    if (nameOf(error) === 'NoSuchBucket') return 'already gone';
    throw error;
  }
}

async function purgeUserPool(id: string): Promise<string> {
  let domain: string | undefined;
  try {
    const pool = (await cognito.send(new DescribeUserPoolCommand({ UserPoolId: id }))).UserPool;
    domain = pool?.CustomDomain ?? pool?.Domain;
  } catch (error) {
    if (nameOf(error) === 'ResourceNotFoundException') return 'already gone';
    throw error;
  }
  if (domain) {
    await cognito
      .send(new DeleteUserPoolDomainCommand({ UserPoolId: id, Domain: domain }))
      .catch(() => undefined);
  }
  // A domain goes away asynchronously, and the pool refuses to go while one is
  // still attached: that refusal, and only that one, is waited out.
  const deadline = Date.now() + 45 * 60_000;
  for (;;) {
    try {
      await cognito.send(new DeleteUserPoolCommand({ UserPoolId: id }));
      return domain ? `deleted, after its domain ${domain}` : 'deleted';
    } catch (error) {
      if (nameOf(error) === 'ResourceNotFoundException') return 'already gone';
      if (nameOf(error) !== 'InvalidParameterException' || Date.now() > deadline) throw error;
      await sleep(30_000);
    }
  }
}

const purge = (each: Retained): Promise<string> => {
  switch (each.kind) {
    case 'table':
      return purgeTable(each.name);
    case 'bucket':
      return purgeBucket(each.name);
    case 'user-pool':
      return purgeUserPool(each.id);
  }
};

say('\nPurging');
let failures = 0;
for (const each of retained) {
  try {
    say(`  ${describeRetained(each)}: ${await purge(each)}`);
  } catch (error) {
    failures += 1;
    say(`  ${describeRetained(each)}: could not be deleted, ${messageOf(error)}`);
  }
}

const groups: string[] = [];
for await (const page of paginateDescribeLogGroups(
  { client: logs },
  { logGroupNamePrefix: `/aws/lambda/${stackIdOf(environment, '')}` },
)) {
  for (const group of page.logGroups ?? []) if (group.logGroupName) groups.push(group.logGroupName);
}
const functions: string[] = [];
for await (const page of paginateListFunctions({ client: lambda }, {})) {
  for (const found of page.Functions ?? [])
    if (found.FunctionName) functions.push(found.FunctionName);
}
for (const group of orphanLogGroups({ environment, groups, functions })) {
  try {
    await logs.send(new DeleteLogGroupCommand({ logGroupName: group }));
    say(`  log group ${group}: deleted`);
  } catch (error) {
    failures += 1;
    say(`  log group ${group}: could not be deleted, ${messageOf(error)}`);
  }
}

if (failures > 0) {
  refuse(`\nThe stacks are gone, and ${failures} resource(s) above are still standing.`);
}
say(`\n${environment} is gone. Its hosted zone and its pipeline stay, and the next run raises it.`);
