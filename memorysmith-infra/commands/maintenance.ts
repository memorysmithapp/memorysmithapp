/**
 * Runs a maintenance job of the core against the tables of an environment
 * (architecture-guide.md, sections 10.3 and 11).
 *
 *   pnpm -C memorysmith-infra cleanup-staging [--apply]
 *   pnpm -C memorysmith-infra recount-storage --environment production [--apply]
 *   pnpm -C memorysmith-infra reproject-links --environment staging [--apply]
 *
 * With credentials of the account of the environment, and refused under any
 * other; a job that names the environments it may run in is refused in every
 * other one before anything is read. The job reports first and writes only with --apply, and its exit code
 * is this command's: reproject-links exits 2 when an edge was lost.
 *
 * The job is the product's own code, run as a process of its own. A command
 * never imports the product, and this one hands the core the names of the
 * resources and nothing else.
 */

import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  accountRefusal,
  environmentRefusal,
  isMaintenanceJob,
  jobVariables,
  MAINTENANCE_JOBS,
} from './lib/maintenance.js';
import { readText, REPOSITORY_ROOT } from './lib/repository.js';
import { stackIdOf } from './lib/teardown.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    environment: { type: 'string', default: 'staging' },
    apply: { type: 'boolean', default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [name = ''] = positionals;
if (!isMaintenanceJob(name)) {
  fail(
    `There is no job called "${name}". Choose one of: ${Object.keys(MAINTENANCE_JOBS).join(', ')}.`,
  );
}
const job = MAINTENANCE_JOBS[name];

const environment = values.environment;
const refusedHere = environmentRefusal(job, environment);
if (refusedHere) fail(refusedHere);
const declared = (
  JSON.parse(readText('memorysmith-infra/cdk.json')) as {
    context: { environments: Record<string, { account?: string; region?: string } | undefined> };
  }
).context.environments[environment];
if (!declared) fail(`There is no environment called "${environment}".`);
const region = declared.region ?? 'us-east-1';

const caller = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
const refusal = accountRefusal({
  environment,
  callerAccount: caller.Account ?? '',
  environmentAccount: declared.account,
});
if (refusal) fail(refusal);

const cloudFormation = new CloudFormationClient({ region });
async function outputOf(stack: 'Data' | 'Identity', key: string): Promise<string> {
  const name = stackIdOf(environment, stack);
  const outputs =
    (await cloudFormation.send(new DescribeStacksCommand({ StackName: name }))).Stacks?.[0]
      ?.Outputs ?? [];
  return (
    outputs.find((output) => output.OutputKey === key)?.OutputValue ??
    fail(`${name} has no ${key} output.`)
  );
}
const contentBucket = await outputOf('Data', 'ContentBucketName');
const userPoolId = await outputOf('Identity', 'UserPoolId');

const what = 'deletes' in job ? `Deleting ${job.deletes}` : `Rebuilding ${job.rebuilds}`;
process.stdout.write(`${what} of ${environment}${values.apply ? '' : ', as a report'}.\n`);

// tsx, run by node itself, so no shell stands between the arguments and the job.
const tsx = createRequire(import.meta.url).resolve('tsx/cli');
const run = spawnSync(
  process.execPath,
  [tsx, join(REPOSITORY_ROOT, job.entry), ...(values.apply ? ['--apply'] : [])],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      AWS_REGION: region,
      ...jobVariables({ environment, contentBucket, userPoolId }),
    },
  },
);
process.exit(run.status ?? 1);
