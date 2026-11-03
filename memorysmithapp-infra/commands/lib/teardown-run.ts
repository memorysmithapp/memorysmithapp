/**
 * What tearing an environment down does, once its command decided which
 * stacks go: `destroy-staging` for the project's own staging, and
 * `destroy-installation` for an installation of somebody else (#391).
 *
 * In order:
 * 1. what the stacks retain is listed before they go, because afterwards
 *    nothing says which table or bucket was theirs;
 * 2. an operation already running on a stack is joined, not raced;
 * 3. the stacks are deleted one at a time, in the order given, which is the
 *    reverse of a delivery: a stack goes before what it imports from. Deleting
 *    a sign-in domain alone takes over half an hour;
 * 4. what no removal policy deletes is purged: the tables, the audit trail
 *    included, the content bucket with every version, the user pool, and the
 *    log groups of functions that are gone.
 *
 * Every call goes to the region of the stack it is about, so an installation
 * whose certificates live in us-east-1 is torn down whole.
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
import { setTimeout as sleep } from 'node:timers/promises';
import {
  chunks,
  describeRetained,
  orphanLogGroups,
  retainedOf,
  stackIdOf,
  type Retained,
  type StackInRegion,
  type StackResource,
} from './teardown.js';

const nameOf = (error: unknown): unknown => (error as { name?: unknown }).name;
export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** One client of each service per region, made the first time it is asked for. */
function clientsOf(region: string) {
  return {
    cloudformation: new CloudFormationClient({ region }),
    dynamodb: new DynamoDBClient({ region }),
    s3: new S3Client({ region }),
    cognito: new CognitoIdentityProviderClient({ region }),
    logs: new CloudWatchLogsClient({ region }),
    lambda: new LambdaClient({ region }),
  };
}
type Clients = ReturnType<typeof clientsOf>;
const made = new Map<string, Clients>();
export function clients(region: string): Clients {
  let found = made.get(region);
  if (!found) {
    found = clientsOf(region);
    made.set(region, found);
  }
  return found;
}

// ---- Stacks ------------------------------------------------------------------

export interface StackState {
  readonly status: string;
  readonly reason: string | undefined;
}

export async function stateOf(target: StackInRegion): Promise<StackState | null> {
  try {
    const described = (
      await clients(target.region).cloudformation.send(
        new DescribeStacksCommand({ StackName: target.stack }),
      )
    ).Stacks?.[0];
    return described?.StackStatus
      ? { status: described.StackStatus, reason: described.StackStatusReason }
      : null;
  } catch (error) {
    if (messageOf(error).includes('does not exist')) return null;
    throw error;
  }
}

/** Waits until nothing is in flight on the stack, and answers null once it is gone. */
async function settled(target: StackInRegion): Promise<StackState | null> {
  const deadline = Date.now() + 90 * 60_000;
  for (;;) {
    const state = await stateOf(target);
    if (state === null || !state.status.endsWith('_IN_PROGRESS')) return state;
    if (Date.now() > deadline) {
      throw new Error(`${target.stack} is still ${state.status} after 90 minutes.`);
    }
    await sleep(20_000);
  }
}

/** What is retained by a stack, with the region it is purged in. */
export interface RetainedIn {
  readonly retained: Retained;
  readonly region: string;
}

export interface Survey {
  readonly present: StackInRegion[];
  readonly retained: RetainedIn[];
}

/** Which of the stacks exist, and what they retain, before anything is deleted. */
export async function survey(
  stacks: readonly StackInRegion[],
  say: (line: string) => void,
): Promise<Survey> {
  const present: StackInRegion[] = [];
  const retained: RetainedIn[] = [];
  for (const target of stacks) {
    const state = await stateOf(target);
    const where = `${target.stack} (${target.region})`;
    if (state === null) {
      say(`  ${where.padEnd(52)} not deployed`);
      continue;
    }
    say(`  ${where.padEnd(52)} ${state.status}`);
    present.push(target);
    const resources: StackResource[] = [];
    for await (const page of paginateListStackResources(
      { client: clients(target.region).cloudformation },
      { StackName: target.stack },
    )) {
      for (const summary of page.StackResourceSummaries ?? []) {
        resources.push({
          type: summary.ResourceType ?? '',
          physicalId: summary.PhysicalResourceId ?? '',
        });
      }
    }
    for (const each of retainedOf(resources))
      retained.push({ retained: each, region: target.region });
  }
  return { present, retained };
}

/**
 * Deletes the stacks one at a time, and stops at the first that does not go:
 * the stacks after it in the list depend on it, and deleting on would only
 * pile failures on top of this one. Answers the failure, or null.
 */
export async function deleteStacks(
  present: readonly StackInRegion[],
  say: (line: string) => void,
): Promise<string | null> {
  for (const target of present) {
    const before = await settled(target);
    if (before === null) {
      say(`  ${target.stack.padEnd(44)} gone, by the operation that was already running`);
      continue;
    }
    await clients(target.region).cloudformation.send(
      new DeleteStackCommand({ StackName: target.stack }),
    );
    const after = await settled(target);
    if (after !== null) {
      return `  ${target.stack} ended ${after.status}: ${after.reason ?? 'CloudFormation gave no reason'}.`;
    }
    say(`  ${target.stack.padEnd(44)} deleted`);
  }
  return null;
}

// ---- What no removal policy deletes -----------------------------------------

async function purgeTable(name: string, region: string): Promise<string> {
  try {
    await clients(region).dynamodb.send(new DeleteTableCommand({ TableName: name }));
    return 'deleted';
  } catch (error) {
    if (nameOf(error) === 'ResourceNotFoundException') return 'already gone';
    throw error;
  }
}

export async function purgeBucket(name: string, region: string): Promise<string> {
  const { s3 } = clients(region);
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

async function purgeUserPool(id: string, region: string): Promise<string> {
  const { cognito } = clients(region);
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

function purgeOne({ retained, region }: RetainedIn): Promise<string> {
  switch (retained.kind) {
    case 'table':
      return purgeTable(retained.name, region);
    case 'bucket':
      return purgeBucket(retained.name, region);
    case 'user-pool':
      return purgeUserPool(retained.id, region);
  }
}

/**
 * Purges what the stacks retained, then the log groups Lambda made for their
 * functions, in each region given. Answers how many could not be deleted.
 */
export async function purge(input: {
  readonly retained: readonly RetainedIn[];
  readonly environment: string;
  readonly installation?: string | null;
  readonly regions: readonly string[];
  readonly say: (line: string) => void;
}): Promise<number> {
  let failures = 0;
  for (const each of input.retained) {
    try {
      input.say(`  ${describeRetained(each.retained)}: ${await purgeOne(each)}`);
    } catch (error) {
      failures += 1;
      input.say(`  ${describeRetained(each.retained)}: could not be deleted, ${messageOf(error)}`);
    }
  }
  for (const region of new Set(input.regions)) {
    const { logs, lambda } = clients(region);
    const groups: string[] = [];
    for await (const page of paginateDescribeLogGroups(
      { client: logs },
      {
        logGroupNamePrefix: `/aws/lambda/${stackIdOf(input.environment, '', input.installation)}`,
      },
    )) {
      for (const group of page.logGroups ?? [])
        if (group.logGroupName) groups.push(group.logGroupName);
    }
    const functions: string[] = [];
    for await (const page of paginateListFunctions({ client: lambda }, {})) {
      for (const found of page.Functions ?? [])
        if (found.FunctionName) functions.push(found.FunctionName);
    }
    const orphans = orphanLogGroups({
      environment: input.environment,
      installation: input.installation ?? null,
      groups,
      functions,
    });
    for (const group of orphans) {
      try {
        await logs.send(new DeleteLogGroupCommand({ logGroupName: group }));
        input.say(`  log group ${group}: deleted`);
      } catch (error) {
        failures += 1;
        input.say(`  log group ${group}: could not be deleted, ${messageOf(error)}`);
      }
    }
  }
  return failures;
}
