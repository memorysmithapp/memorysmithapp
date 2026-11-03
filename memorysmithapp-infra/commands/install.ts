/**
 * Prepares an AWS account for an installation of somebody else (#342).
 *
 *   pnpm -C memorysmithapp-infra install-account --environment staging [--check]
 *
 * It reads what `.env.example` documents, from `.env.<environment>` or from the
 * variables already set, and changes nothing until everything it can check
 * holds: the account of the credentials, the services of the region, the hosted
 * zone and its delegation, the CDK bootstrap, the key DynamoDB encrypts with,
 * and no table a failed first delivery left behind (#378). `--check` stops
 * there. Then it bootstraps what has no bootstrap, us-east-1 too when the
 * certificates of CloudFront have to live there, creates the key when the
 * region has none, and on a fork creates the OIDC provider of the account, if
 * there is none, and the delivery role of the environment.
 *
 * Without `--check` it runs each step without asking, so `--check` is how a
 * person sees what it would change. Each step looks for what exists first, so
 * running it again reuses what the last run made and goes on from where a
 * failure stopped it. A bootstrap it cannot use is reported and never
 * replaced. It ends by saying what is left for a person.
 */

import {
  CloudFormationClient,
  DescribeStackEventsCommand,
  DescribeStacksCommand,
  type Stack,
} from '@aws-sdk/client-cloudformation';
import { DescribeTableCommand, DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import {
  AddClientIDToOpenIDConnectProviderCommand,
  CreateOpenIDConnectProviderCommand,
  IAMClient,
  ListOpenIDConnectProvidersCommand,
} from '@aws-sdk/client-iam';
import { DescribeKeyCommand, KMSClient, paginateListAliases } from '@aws-sdk/client-kms';
import { GetHostedZoneCommand, Route53Client } from '@aws-sdk/client-route-53';
import { GetParameterCommand, GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { spawnSync } from 'node:child_process';
import { resolveNs } from 'node:dns/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  installationEnvironmentOf,
  loadInstallationFile,
  physicalName,
  stackId,
  trustOf,
  type EnvironmentConfig,
  type EnvironmentName,
} from '../installation/index.js';
import {
  bootstrapVerdict,
  DATA_TABLES,
  delegationProblem,
  DYNAMODB_KEY_ALIAS,
  humanSteps,
  leftBehindProblem,
  managedKeyExists,
  REQUIRED_SERVICES,
  servicesMissingIn,
  tablesLeftBehind,
} from './lib/install.js';
import { REPOSITORY_ROOT } from './lib/repository.js';

const { values } = parseArgs({
  options: {
    environment: { type: 'string', default: process.env['ENVIRONMENT'] ?? 'staging' },
    check: { type: 'boolean', default: false },
  },
});

const say = (line: string): void => void process.stdout.write(`${line}\n`);

function refuse(message: string): never {
  console.error(`\n${message}\nNothing else was changed. Run this again once it is fixed.`);
  process.exit(1);
}

const requested = values.environment;
loadInstallationFile(requested);
if (!process.env['INSTALLATION']?.trim()) {
  refuse(`INSTALLATION is not set: fill .env.${requested} from .env.example.`);
}

if (requested !== 'production' && requested !== 'staging') {
  refuse(`There is no environment called "${requested}".`);
}
let environment: EnvironmentConfig;
try {
  environment = installationEnvironmentOf(
    requested as EnvironmentName,
    { tryGetContext: () => undefined },
    process.env,
  );
} catch (error) {
  refuse((error as Error).message);
}
const { account, region } = environment;
// Only the certificates of a domain have to live in us-east-1.
const regions =
  region === 'us-east-1' || !environment.hostedZoneName ? [region] : [region, 'us-east-1'];

// ---- What it can check before changing anything -----------------------------

say(`Checking ${environment.installation} ${environment.name}: ${account}, ${region}.`);

const caller = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
if (caller.Account !== account) {
  refuse(
    `These credentials belong to account ${caller.Account}, and AWS_ACCOUNT_ID is ${account}.`,
  );
}
say('  the credentials belong to the account.');

// The public list AWS keeps answers from any region, on no resource of the account.
const ssm = (where: string): SSMClient => new SSMClient({ region: where });
const regionsOf: Record<string, string[]> = {};
for (const service of REQUIRED_SERVICES) {
  if (service === 'cloudfront') continue;
  const names: string[] = [];
  let NextToken: string | undefined;
  do {
    const page = await ssm(region).send(
      new GetParametersByPathCommand({
        Path: `/aws/service/global-infrastructure/services/${service}/regions`,
        ...(NextToken ? { NextToken } : {}),
      }),
    );
    names.push(...(page.Parameters ?? []).map((parameter) => parameter.Value ?? ''));
    NextToken = page.NextToken;
  } while (NextToken);
  regionsOf[service] = names;
}
const missing = servicesMissingIn(region, regionsOf);
if (missing.length > 0) {
  refuse(`${region} lacks what the product uses: ${missing.join(', ')}. Choose another region.`);
}
say(`  ${region} has every service the product uses.`);

if (environment.hostedZoneName && environment.hostedZoneId) {
  const zone = await new Route53Client({ region: 'us-east-1' })
    .send(new GetHostedZoneCommand({ Id: environment.hostedZoneId }))
    .catch(() => null);
  const name = zone?.HostedZone?.Name?.replace(/\.$/, '');
  if (!zone || name !== environment.hostedZoneName) {
    refuse(
      `The account has no hosted zone ${environment.hostedZoneId} for ${environment.hostedZoneName}: found ${name ?? 'none'}.`,
    );
  }
  if (zone.HostedZone?.Config?.PrivateZone) {
    refuse(
      `${environment.hostedZoneName} is a private zone, and the installation needs a public one.`,
    );
  }
  const answered = await resolveNs(environment.hostedZoneName).catch(() => [] as string[]);
  const problem = delegationProblem(
    environment.hostedZoneName,
    zone.DelegationSet?.NameServers ?? [],
    answered,
  );
  if (problem) refuse(problem);
  say(`  ${environment.hostedZoneName} is a public zone of the account, and delegated to it.`);
} else {
  say('  no domain: the installation answers on the default endpoints of AWS.');
}

const toolkitOf = async (where: string): Promise<Stack | null> =>
  new CloudFormationClient({ region: where })
    .send(new DescribeStacksCommand({ StackName: 'CDKToolkit' }))
    .then((found) => found.Stacks?.[0] ?? null)
    .catch(() => null);

const bootstrapOf = async (where: string) => {
  const stack = await toolkitOf(where);
  const version = await ssm(where)
    .send(new GetParameterCommand({ Name: '/cdk-bootstrap/hnb659fds/version' }))
    .then((found) => Number(found.Parameter?.Value))
    .catch(() => null);
  return bootstrapVerdict({ status: stack?.StackStatus ?? null, version });
};

const absent: string[] = [];
for (const where of regions) {
  const verdict = await bootstrapOf(where);
  if (verdict.kind === 'incompatible') {
    refuse(
      `The CDK bootstrap of ${where} cannot be used: ${verdict.reason}. It was left as it is.`,
    );
  }
  if (verdict.kind === 'absent') absent.push(where);
  say(`  the CDK bootstrap of ${where} is ${verdict.kind}.`);
}

// The tables live in the region of the installation, and only there.
const kms = new KMSClient({ region });
const aliases = [];
for await (const page of paginateListAliases({ client: kms }, {})) {
  aliases.push(...(page.Aliases ?? []));
}
const keyExists = managedKeyExists(aliases);
say(
  keyExists
    ? `  the key ${DYNAMODB_KEY_ALIAS} of ${region} exists.`
    : `  the key ${DYNAMODB_KEY_ALIAS} of ${region} is absent, and is created before anything deploys.`,
);

const dataStack = stackId(environment, 'Data');
const dataStatus = await new CloudFormationClient({ region })
  .send(new DescribeStacksCommand({ StackName: dataStack }))
  .then((found) => found.Stacks?.[0]?.StackStatus ?? null)
  .catch(() => null);
const dynamodb = new DynamoDBClient({ region });
const expected = DATA_TABLES.map((base) => physicalName(environment, base));
const existing: string[] = [];
for (const name of expected) {
  const found = await dynamodb
    .send(new DescribeTableCommand({ TableName: name }))
    .then(() => true)
    .catch((error: Error) => {
      // Only an absent table is an answer; a refused read must not pass for one.
      if (error.name === 'ResourceNotFoundException') return false;
      throw error;
    });
  if (found) existing.push(name);
}
const leftBehind = tablesLeftBehind({ stackStatus: dataStatus, expected, existing });
if (leftBehind.length > 0) {
  const tables = [];
  for (const name of leftBehind) {
    // One item is enough to say a table is not empty, and the count AWS keeps lags.
    const scanned = await dynamodb.send(
      new ScanCommand({ TableName: name, Limit: 1, Select: 'COUNT' }),
    );
    tables.push({ name, empty: (scanned.Count ?? 0) === 0 && !scanned.LastEvaluatedKey });
  }
  const buckets: string[] = [];
  if (dataStatus !== null) {
    const events = await new CloudFormationClient({ region }).send(
      new DescribeStackEventsCommand({ StackName: dataStack }),
    );
    for (const event of events.StackEvents ?? []) {
      if (
        event.ResourceType === 'AWS::S3::Bucket' &&
        event.ResourceStatus === 'DELETE_SKIPPED' &&
        event.PhysicalResourceId
      ) {
        buckets.push(event.PhysicalResourceId);
      }
    }
  }
  refuse(leftBehindProblem({ stack: dataStack, stackStatus: dataStatus, tables, buckets }));
}

if (values.check) {
  say('\nEverything checked holds, and nothing was changed.');
  process.exit(0);
}

// ---- What it changes --------------------------------------------------------

const require_ = createRequire(import.meta.url);
const cdk = require_.resolve('aws-cdk/bin/cdk');
const infra = join(REPOSITORY_ROOT, 'memorysmithapp-infra');

const run = (label: string, file: string, args: readonly string[]): void => {
  say(`\n${label}`);
  const outcome = spawnSync(file, [...args], { stdio: 'inherit', cwd: infra });
  if (outcome.status !== 0) refuse(`${label} failed.`);
};

for (const where of absent) {
  run(`Bootstrapping ${where}`, process.execPath, [cdk, 'bootstrap', `aws://${account}/${where}`]);
}

if (!keyExists) {
  // Describing the alias of a managed key AWS has not created yet creates it.
  const described = await kms
    .send(new DescribeKeyCommand({ KeyId: DYNAMODB_KEY_ALIAS }))
    .catch((error: Error) => refuse(`Creating ${DYNAMODB_KEY_ALIAS} failed: ${error.message}`));
  if (!described.KeyMetadata?.KeyId) refuse(`AWS created no key behind ${DYNAMODB_KEY_ALIAS}.`);
  say(`\nCreated the key ${DYNAMODB_KEY_ALIAS} of ${region}, which every table is encrypted with.`);
}

let roleArn: string | null = null;
if (environment.repositoryHost !== 'none') {
  const trust = trustOf(environment);
  const iam = new IAMClient({ region });
  const providers = await iam.send(new ListOpenIDConnectProvidersCommand({}));
  let provider = providers.OpenIDConnectProviderList?.find((each) =>
    each.Arn?.endsWith(`:oidc-provider/${trust.issuer}`),
  )?.Arn;
  if (provider) {
    await iam.send(
      new AddClientIDToOpenIDConnectProviderCommand({
        OpenIDConnectProviderArn: provider,
        ClientID: trust.audience,
      }),
    );
    say(`\nThe account already trusts ${trust.issuer}, and that provider is reused.`);
  } else {
    const created = await iam.send(
      new CreateOpenIDConnectProviderCommand({
        Url: `https://${trust.issuer}`,
        ClientIDList: [trust.audience],
      }),
    );
    provider = created.OpenIDConnectProviderArn;
    say(`\nCreated the OIDC provider of ${trust.issuer}.`);
  }

  // The app synthesises whole, and the release stack reads what the build made.
  if (!existsSync(join(REPOSITORY_ROOT, 'memorysmithapp-frontend', 'dist'))) {
    run('Building the SPA', 'pnpm', ['-C', '../memorysmithapp-frontend', 'build']);
  }
  const stack = stackId(environment, 'Delivery');
  run('Deploying the delivery role', process.execPath, [
    cdk,
    'deploy',
    stack,
    '--exclusively',
    '--require-approval',
    'never',
    '-c',
    `environment=${environment.name}`,
    '-c',
    `oidcProviderArn=${provider}`,
    ...(environment.alarmEmail ? ['-c', `alarmEmail=${environment.alarmEmail}`] : []),
  ]);
  const deployed = await new CloudFormationClient({ region }).send(
    new DescribeStacksCommand({ StackName: stack }),
  );
  roleArn =
    deployed.Stacks?.[0]?.Outputs?.find((output) => output.OutputKey === 'RoleArn')?.OutputValue ??
    null;
}

say('\nThe account is prepared. What is left for a person:');
humanSteps(environment, roleArn).forEach((step, index) => say(`  ${index + 1}. ${step}`));
