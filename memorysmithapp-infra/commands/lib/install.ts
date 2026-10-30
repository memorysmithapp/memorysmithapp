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
    'Once, for the account: pnpm -C memorysmithapp-infra activate-cost-tags.',
    `Create the first accounts: pnpm tools onboard --environment ${environment.name} --email … --name … --quota 500MB --status active. The first one becomes the platform administrator, with no subscription; run it again for the account you use the product with.`,
  );
  return steps;
}
