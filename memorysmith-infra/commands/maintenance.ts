/**
 * Runs a maintenance job of the core against the tables of an environment
 * (architecture-guide.md, sections 10.3 and 11).
 *
 *   pnpm -C memorysmith-infra recount-storage --environment production [--apply]
 *   pnpm -C memorysmith-infra reproject-links --environment staging [--apply]
 *
 * With credentials of the account of the environment, and refused under any
 * other. The job reports first and writes only with --apply, and its exit code
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

const dataStack = stackIdOf(environment, 'Data');
const outputs =
  (
    await new CloudFormationClient({ region }).send(
      new DescribeStacksCommand({ StackName: dataStack }),
    )
  ).Stacks?.[0]?.Outputs ?? [];
const contentBucket =
  outputs.find((output) => output.OutputKey === 'ContentBucketName')?.OutputValue ??
  fail(`${dataStack} has no ContentBucketName output.`);

process.stdout.write(
  `Rebuilding ${job.rebuilds} of ${environment}${values.apply ? '' : ', as a report'}.\n`,
);

// tsx, run by node itself, so no shell stands between the arguments and the job.
const tsx = createRequire(import.meta.url).resolve('tsx/cli');
const run = spawnSync(
  process.execPath,
  [tsx, join(REPOSITORY_ROOT, job.entry), ...(values.apply ? ['--apply'] : [])],
  {
    stdio: 'inherit',
    env: { ...process.env, AWS_REGION: region, ...jobVariables({ environment, contentBucket }) },
  },
);
process.exit(run.status ?? 1);
