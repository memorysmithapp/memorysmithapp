/**
 * Runs a maintenance job of the core against the tables of an environment
 * (ADR-010, ADR-017).
 *
 *   pnpm tools data cleanup-staging [--apply]
 *   pnpm tools data recount-storage --environment production [--apply]
 *   pnpm tools data purge-deleted-files --environment production [--apply]
 *   pnpm tools data reproject-links --environment staging [--apply]
 *   pnpm tools data reproject-links --environment staging --follow <execution>
 *
 * With credentials of the account of the environment, and refused under any
 * other; a job that names the environments it may run in is refused in every
 * other one before anything is read. The job reports first and writes only with --apply, and its exit code
 * is this command's: reproject-links exits 2 when an edge was lost.
 *
 * The job is the product's own code. Most run as a process of their own, and a
 * command never imports the product, so this one hands the core the names of
 * the resources and nothing else. `reproject-links` runs in AWS instead, as a
 * state machine (#311): the command starts the run, follows it and prints its
 * summary, and a run whose command was interrupted finishes on its own, to be
 * followed again with `--follow`.
 */

import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import {
  DescribeExecutionCommand,
  DescribeMapRunCommand,
  ListMapRunsCommand,
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn';
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
  progressLine,
  runExitCode,
  summaryLines,
  type ReprojectionSummary,
} from './lib/maintenance.js';
import { declaredEnvironment, stackIdOf } from './lib/environments.js';
import { REPOSITORY_ROOT } from './lib/repository.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    environment: { type: 'string', default: 'staging' },
    apply: { type: 'boolean', default: false },
    follow: { type: 'string' },
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
const declared = declaredEnvironment(environment);
if (!declared) fail(`There is no environment called "${environment}".`);
const region = declared.region ?? 'us-east-1';

const caller = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
const refusal = accountRefusal({
  environment,
  callerAccount: caller.Account ?? '',
  environmentAccount: declared.account,
});
if (refusal) fail(refusal);

const what = 'deletes' in job ? `Deleting ${job.deletes}` : `Rebuilding ${job.rebuilds}`;
process.stdout.write(`${what} of ${environment}${values.apply ? '' : ', as a report'}.\n`);

if ('stateMachine' in job) {
  process.exit(
    await followRun({
      stateMachineArn: `arn:aws:states:${region}:${caller.Account}:stateMachine:${job.stateMachine}-${environment}`,
      mode: values.apply ? 'apply' : 'report',
      ...(values.follow ? { executionArn: values.follow } : {}),
    }),
  );
}

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

/**
 * Starts a run of a state machine, or joins one already started, and follows
 * it until it ends: how many notebooks are done, then the summary it answered.
 */
async function followRun(input: {
  readonly stateMachineArn: string;
  readonly mode: 'report' | 'apply';
  readonly executionArn?: string;
}): Promise<number> {
  const sfn = new SFNClient({ region });
  const executionArn =
    input.executionArn ??
    (
      await sfn.send(
        new StartExecutionCommand({
          stateMachineArn: input.stateMachineArn,
          name: `${input.mode}-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}`,
          input: JSON.stringify({ mode: input.mode }),
        }),
      )
    ).executionArn ??
    fail('The run was not started.');
  process.stdout.write(
    `Run ${executionArn}\n` +
      `  https://${region}.console.aws.amazon.com/states/home?region=${region}#/v2/executions/details/${executionArn}\n` +
      '  It runs in AWS: stopping this command leaves it running, and --follow joins it again.\n',
  );

  const started = Date.now();
  let last = '';
  for (;;) {
    const execution = await sfn.send(new DescribeExecutionCommand({ executionArn }));
    if (execution.status !== 'RUNNING' && execution.status !== 'PENDING_REDRIVE') {
      const minutes = (
        ((execution.stopDate ?? new Date()).getTime() -
          (execution.startDate ?? new Date(started)).getTime()) /
        60000
      ).toFixed(1);
      process.stdout.write(`\nThe run ended ${execution.status} after ${minutes} minute(s).\n\n`);
      const answered =
        execution.status === 'SUCCEEDED'
          ? execution.output
          : execution.error === 'ReprojectionNotGood'
            ? execution.cause
            : undefined;
      if (!answered) {
        process.stdout.write(`${execution.error ?? ''} ${execution.cause ?? ''}\n`);
        return 1;
      }
      const summary = JSON.parse(answered) as ReprojectionSummary;
      process.stdout.write(`${summaryLines(summary).join('\n')}\n`);
      return runExitCode(summary);
    }

    const mapRunArn = (await sfn.send(new ListMapRunsCommand({ executionArn }))).mapRuns?.[0]
      ?.mapRunArn;
    if (mapRunArn) {
      const counts = (await sfn.send(new DescribeMapRunCommand({ mapRunArn }))).itemCounts;
      const line = progressLine({
        total: counts?.total ?? 0,
        succeeded: counts?.succeeded ?? 0,
        failed: counts?.failed ?? 0,
        running: counts?.running ?? 0,
      });
      if (line !== last) process.stdout.write(`${line}\n`);
      last = line;
    }
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
}
