/**
 * Delivers an environment from a workstation (architecture-guide.md, §20).
 *
 *   pnpm -C memorysmith-infra deliver [--environment staging] [--skip-build]
 *
 * It is what the Deliver and Smoke stages ran, in one command and in the same
 * order, because the order is not a preference: the site of the environment has
 * to resolve an A record before Cognito accepts a sign-in domain below it, and
 * the pool sends only from a verified identity. So the network and the hosting
 * go first, then the wait on DNS and on the sending identity, then every other
 * stack, and the read-only smoke closes it (§17).
 *
 * The version comes from the checkout, exactly as it came from the clone of a
 * build (§23.3), and the commit it records is the one checked out: a working
 * tree with uncommitted changes is said out loud, because `deploy:sha` would
 * otherwise name a commit that never held what is being served.
 *
 * It refuses any account but the one cdk.json names for the environment.
 */

import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { servedVersion, type ServingEnvironment } from './lib/release.js';
import { commitsAheadOfMain, git, readText, REPOSITORY_ROOT } from './lib/repository.js';
import { DELIVERY_ORDER, stackIdOf } from './lib/teardown.js';

const { values } = parseArgs({
  options: {
    environment: { type: 'string', default: process.env['ENVIRONMENT'] ?? 'staging' },
    'skip-build': { type: 'boolean', default: false },
    'skip-smoke': { type: 'boolean', default: false },
  },
});

const say = (line: string): void => void process.stdout.write(`${line}\n`);

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

// ---- Which environment, and whose credentials -------------------------------

const environment = values.environment;
if (environment !== 'production' && environment !== 'staging') {
  refuse(`There is no environment called "${environment}".`);
}

const declared = (
  JSON.parse(readText('memorysmith-infra/cdk.json')) as {
    context: {
      environments: Record<
        string,
        { account?: string; region?: string; hostedZoneName?: string } | undefined
      >;
    };
  }
).context.environments[environment];

const account = declared?.account ?? refuse(`cdk.json names no account for ${environment}.`);
const region = declared?.region ?? 'us-east-1';
const zone = declared?.hostedZoneName ?? refuse(`cdk.json names no zone for ${environment}.`);

const caller = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
if (caller.Account !== account) {
  refuse(
    `These credentials belong to account ${caller.Account}, and ${environment} lives in ${account}. Nothing was deployed.`,
  );
}

// ---- What it serves ---------------------------------------------------------

const sha = git('rev-parse', 'HEAD');
const version = servedVersion({
  environment: environment as ServingEnvironment,
  packageVersion: (JSON.parse(readText('memorysmith-infra/package.json')) as { version: string })
    .version,
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  commitsAhead: environment === 'production' ? 0 : commitsAheadOfMain(),
  sha,
});

say(`Delivering ${version} to ${environment}, account ${account}, ${region}.`);
if (git('status', '--porcelain').length > 0) {
  say(`  the working tree has changes that ${sha.slice(0, 7)} does not hold.`);
}

// ---- Running the steps ------------------------------------------------------

const require_ = createRequire(import.meta.url);
/** tsx and the CDK, run by node itself, so no shell stands between the arguments. */
const tsx = require_.resolve('tsx/cli');
const cdk = require_.resolve('aws-cdk/bin/cdk');
const pnpm = process.env['npm_execpath'];

const run = (label: string, file: string, args: readonly string[]): void => {
  say(`\n${label}`);
  const outcome = spawnSync(file, [...args], {
    stdio: 'inherit',
    cwd: join(REPOSITORY_ROOT, 'memorysmith-infra'),
  });
  if (outcome.status !== 0) refuse(`\n${label} failed. Nothing after it ran.`);
};

const node = (label: string, args: readonly string[]): void => run(label, process.execPath, args);
const command = (label: string, name: string, args: readonly string[]): void =>
  node(label, [tsx, join(REPOSITORY_ROOT, 'memorysmith-infra', 'commands', name), ...args]);
const deploy = (label: string, stacks: readonly string[]): void =>
  node(label, [cdk, 'deploy', '--app', 'cdk.out', '--require-approval', 'never', ...stacks]);

const ids = (names: readonly string[]): string[] =>
  names.map((name) => stackIdOf(environment, name));

if (!values['skip-build']) {
  if (!pnpm)
    refuse('deliver builds the SPA through pnpm: run it as `pnpm -C memorysmith-infra deliver`.');
  run('Building the SPA', process.execPath, [pnpm, '-C', '../memorysmith-frontend', 'build']);
}

node('Synthesising', [
  cdk,
  'synth',
  '--quiet',
  '-c',
  `environment=${environment}`,
  '-c',
  `version=${version}`,
  '-c',
  `commit=${sha}`,
]);

deploy('Deploying the network and the hosting', ids(['Network', 'Frontend']));
command('Waiting on DNS', 'wait-for-dns.ts', ['--name', zone]);
command('Waiting on the sending identity', 'wait-for-email-identity.ts', ['--identity', zone]);
deploy('Deploying the product', ids(DELIVERY_ORDER));

if (!values['skip-smoke']) {
  command('Smoke', 'smoke.ts', [
    '--environment',
    environment,
    '--version',
    version,
    '--site',
    `https://${zone}`,
    '--api',
    `https://api.${zone}`,
    '--mcp',
    `https://mcp.${zone}`,
  ]);
}

say(`\n${environment} serves ${version}.`);
