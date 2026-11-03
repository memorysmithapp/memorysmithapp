/**
 * What preparing an account decides (#342). Nothing here calls AWS: the command
 * asks, and every verdict on what it found is here, where a test can ask too.
 */

import type { DefaultHosts, EnvironmentConfig } from '../../installation/index.js';

/**
 * What the product uses, by the names of the public list AWS keeps of each
 * service's regions, so a region is refused before anything is changed.
 */
export const REQUIRED_SERVICES = [
  'cloudfront',
  'cognito-idp',
  'dynamodb',
  'dynamodbstreams',
  'events',
  'lambda',
  'ses',
  'sqs',
  'stepfunctions',
] as const;

/** The lowest bootstrap this app's assets deploy with. */
export const MINIMUM_BOOTSTRAP = 21;

/** The services a region lacks, given the regions of each service. */
export function servicesMissingIn(
  region: string,
  regionsOf: Readonly<Record<string, readonly string[]>>,
): string[] {
  return REQUIRED_SERVICES.filter(
    // CloudFront is global: it has no region of its own to be listed in.
    (service) => service !== 'cloudfront' && !regionsOf[service]?.includes(region),
  );
}

export type BootstrapVerdict =
  | { readonly kind: 'absent' }
  | { readonly kind: 'compatible' }
  | { readonly kind: 'incompatible'; readonly reason: string };

/** What to do with the bootstrap of a region, which is never replaced or broadened. */
export function bootstrapVerdict(input: {
  readonly status: string | null;
  readonly version: number | null;
}): BootstrapVerdict {
  if (input.status === null) return { kind: 'absent' };
  if (!/_COMPLETE$/.test(input.status) || /ROLLBACK|DELETE/.test(input.status)) {
    return { kind: 'incompatible', reason: `its stack CDKToolkit is ${input.status}` };
  }
  if (input.version === null) {
    return { kind: 'incompatible', reason: 'it uses another qualifier than the default one' };
  }
  if (input.version < MINIMUM_BOOTSTRAP) {
    return {
      kind: 'incompatible',
      reason: `it is at version ${input.version}, and this app needs ${MINIMUM_BOOTSTRAP}`,
    };
  }
  return { kind: 'compatible' };
}

/**
 * The key AWS manages for DynamoDB, which encrypts every table. An account that
 * has never used DynamoDB in a region has none there until its first use, and
 * the Data stack creates its tables at once: a table that asks for the key a
 * moment before another one brought it into existence fails, and the stack
 * rolls back (#378). So the account is given the key before anything deploys.
 */
export const DYNAMODB_KEY_ALIAS = 'alias/aws/dynamodb';

/**
 * Whether the key exists, from the aliases of the region. AWS lists the alias
 * of a managed key it has not created yet, with no key behind it, so a listing
 * reads without creating anything, which a `--check` must not do.
 */
export function managedKeyExists(
  aliases: ReadonlyArray<{ readonly AliasName?: string; readonly TargetKeyId?: string }>,
): boolean {
  return aliases.some((alias) => alias.AliasName === DYNAMODB_KEY_ALIAS && !!alias.TargetKeyId);
}

/**
 * The tables of the Data stack, by the base of their physical names. A test
 * holds this list to the stack, so a table added there is added here.
 */
export const DATA_TABLES = [
  'mv-access',
  'mv-knowledge',
  'mv-discovery',
  'mv-portability',
  'mv-audit',
] as const;

/**
 * The tables a failed first creation of the Data stack left behind. They are
 * retained, so a rollback keeps them outside any stack, and their names are
 * fixed, so the next delivery fails on a name that already exists. A table is
 * left behind only while the stack that should hold it is absent or rolled
 * back from its creation; a stack that exists holds its own tables.
 */
export function tablesLeftBehind(input: {
  readonly stackStatus: string | null;
  readonly expected: readonly string[];
  readonly existing: readonly string[];
}): string[] {
  const stackHoldsThem =
    input.stackStatus !== null && !/^(ROLLBACK_COMPLETE|ROLLBACK_FAILED)$/.test(input.stackStatus);
  if (stackHoldsThem) return [];
  return input.expected.filter((name) => input.existing.includes(name));
}

/**
 * What a person does with what a failed creation left, named one by one. The
 * command deletes none of it: a table is data, and only a person decides that
 * it holds nothing worth keeping.
 */
export function leftBehindProblem(input: {
  readonly stack: string;
  readonly stackStatus: string | null;
  readonly tables: ReadonlyArray<{ readonly name: string; readonly empty: boolean }>;
  readonly buckets: readonly string[];
}): string {
  const names = (tables: typeof input.tables): string =>
    tables.map((table) => table.name).join(', ');
  const empty = input.tables.filter((table) => table.empty);
  const holding = input.tables.filter((table) => !table.empty);
  const lines = [
    `A first creation of ${input.stack} failed and left tables outside any stack, and the next delivery would fail on their names:`,
    ...(empty.length > 0
      ? [`  empty, to delete with aws dynamodb delete-table --table-name <name>: ${names(empty)}.`]
      : []),
    ...(holding.length > 0
      ? [`  holding items, to read before deciding what to do with them: ${names(holding)}.`]
      : []),
    ...(input.buckets.length > 0
      ? [`  it also left the buckets ${input.buckets.join(', ')}, which block nothing.`]
      : []),
    ...(input.stackStatus === null
      ? []
      : [
          `  then delete the stack ${input.stack}, which is ${input.stackStatus} and holds nothing.`,
        ]),
  ];
  return lines.join('\n');
}

const normalised = (servers: readonly string[]): string[] =>
  servers.map((server) => server.toLowerCase().replace(/\.$/, '')).sort();

/** Whether the name servers the public DNS answers are the ones of the zone. */
export function delegationProblem(
  domain: string,
  zone: readonly string[],
  answered: readonly string[],
): string | null {
  if (answered.length === 0) {
    return `${domain} answers no name servers yet: point it at ${zone.join(', ')} at its registrar or parent zone, and run this again.`;
  }
  const wanted = normalised(zone);
  const found = normalised(answered);
  return wanted.join() === found.join()
    ? null
    : `${domain} is delegated to ${found.join(', ')}, and its zone has ${wanted.join(', ')}: fix the delegation at its registrar or parent zone, and run this again.`;
}

/** The hosts the stacks of a delivery answered, or null while one is missing. */
export function hostsFromOutputs(outputs: Readonly<Record<string, string>>): DefaultHosts | null {
  const { SiteHost, ApiHost, McpHost, UploadsHost, FilesHost } = outputs;
  return SiteHost && ApiHost && McpHost && UploadsHost && FilesHost
    ? { site: SiteHost, api: ApiHost, mcp: McpHost, uploads: UploadsHost, files: FilesHost }
    : null;
}

/** What is left for a person, in the order to do it. */
export function humanSteps(environment: EnvironmentConfig, roleArn: string | null): string[] {
  const steps: string[] = [];
  const variables = [
    'INSTALLATION',
    'AWS_ACCOUNT_ID',
    'AWS_REGION',
    ...(environment.hostedZoneName ? ['DOMAIN_NAME', 'HOSTED_ZONE_ID'] : []),
    'REPOSITORY',
    'REPOSITORY_HOST',
    'ALARM_EMAIL',
  ];
  const role = `AWS_${environment.name.toUpperCase()}_ROLE_ARN=${roleArn ?? '<the role>'}`;
  if (environment.repositoryHost === 'github') {
    steps.push(
      `On GitHub, create the environment ${environment.name} in ${environment.repository} and give it the variables ${variables.join(', ')} and ${role}.`,
    );
  }
  if (environment.repositoryHost === 'gitlab') {
    steps.push(
      `On GitLab, create the environment ${environment.name} in ${environment.repository}, protect the branch main, and give the environment the variables ${variables.join(', ')} and ${role}.`,
    );
  }
  steps.push(
    environment.repositoryHost === 'none'
      ? `Deliver: pnpm -C memorysmithapp-infra deliver --environment ${environment.name}.`
      : `Deliver by running the pipeline for ${environment.name}.`,
  );
  if (environment.alarmEmail) {
    steps.push(
      `Confirm the subscription of the alarm topic from the message AWS sends to ${environment.alarmEmail}.`,
    );
  }
  if (!environment.hostedZoneName) {
    steps.push(
      'Without a domain the pool sends through Cognito, which limits it to a few messages a day; the product sends from SENDER_ADDRESS, an address you verified in SES, and sends nothing without one.',
    );
  }
  steps.push(
    'Once, for the account: pnpm -C memorysmithapp-infra activate-cost-tags. When the account belongs to an organization, run it with credentials of the management account, whose tags hold for every account in it.',
    `Create the first accounts: pnpm tools onboard --environment ${environment.name} --email … --name … --quota 500MB --status active. The first one becomes the platform administrator, with no subscription; run it again for the account you use the product with.`,
  );
  return steps;
}
