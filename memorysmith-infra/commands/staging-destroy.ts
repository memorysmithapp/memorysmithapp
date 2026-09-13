/**
 * Starts the teardown of staging (architecture-guide.md, section 20).
 *
 *   pnpm staging:destroy             with credentials of the account
 *
 * It asks for the domain of staging, typed, before anything starts, and hands
 * the pushed head of this branch to the DestroyStaging project, which runs the
 * teardown inside the account. A teardown outlasts a workstation, and killing
 * one on a workstation would cancel nothing CloudFormation had already started.
 */

import { CodeBuildClient, StartBuildCommand } from '@aws-sdk/client-codebuild';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { git, readText } from './lib/repository.js';

const { values } = parseArgs({
  options: {
    project: { type: 'string', default: 'memorysmith-destroy-staging' },
    confirm: { type: 'string' },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const zone = (
  JSON.parse(readText('memorysmith-infra/cdk.json')) as {
    context: { environments: { staging?: { hostedZoneName?: string } } };
  }
).context.environments.staging?.hostedZoneName;
if (!zone) fail('cdk.json declares no staging environment.');

const head = git('rev-parse', 'HEAD');
if (git('branch', '--remotes', '--contains', head).length === 0) {
  fail(`${head.slice(0, 7)} is not pushed. Push it, then start the teardown from it.`);
}

let typed = values.confirm;
if (typed === undefined) {
  const prompts = createInterface({ input: process.stdin, output: process.stdout });
  typed = (await prompts.question(`Type ${zone} to tear staging down: `)).trim();
  prompts.close();
}
if (typed !== zone) fail('That is not the domain of staging. Nothing was started.');

const started = await new CodeBuildClient({}).send(
  new StartBuildCommand({ projectName: values.project, sourceVersion: head }),
);

process.stdout.write(
  `The teardown of staging started from ${head.slice(0, 7)}: build ${started.build?.id}.\n`,
);
