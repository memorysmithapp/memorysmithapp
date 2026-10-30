/**
 * The two environments this app describes.
 *
 * `-c environment=production|staging` chooses one, and everything that differs
 * between them is read from `environments` in cdk.json: the account, the
 * region, the hosted zone and the zones it delegates. A synth that names no
 * environment is production. Two things that differ are not in cdk.json, and
 * arrive as context a delivery passes: the address the alarms and the budgets
 * notify, because the repository is public, and which of the observability
 * that costs money a delivery turns on (ADR-021).
 *
 * The account is never taken from the credentials. Named explicitly in the
 * environment of every stack, it makes the CDK itself refuse to deploy into
 * any account but the one cdk.json names. Production and staging name the same
 * account, so what tells one environment from the other is the name chosen
 * here and every name it produces, never the credentials.
 *
 * An installation of somebody else (#342) names none of this in cdk.json: with
 * `INSTALLATION` set, `installation/` reads all of it from variables, and
 * cdk.json, which keeps only the project's own installation, is not read.
 */

import {
  choiceOf,
  installationEnvironmentOf,
  type ContextReader,
  type Delegation,
  type EnvironmentConfig,
  type EnvironmentName,
  type InstallationVariables,
} from '../installation/index.js';

export {
  GITHUB_ISSUER,
  physicalName,
  stackId,
  trustOf,
  type DefaultHosts,
  type Delegation,
  type EnvironmentConfig,
  type EnvironmentName,
  type RepositoryHost,
} from '../installation/index.js';

export const ENVIRONMENT_NAMES: readonly EnvironmentName[] = ['production', 'staging'];

function delegationOf(raw: unknown, environment: string): Delegation {
  const entry = (raw ?? {}) as Record<string, unknown>;
  const recordName = entry['recordName'];
  const nameServers = entry['nameServers'];
  if (
    typeof recordName !== 'string' ||
    !Array.isArray(nameServers) ||
    nameServers.length === 0 ||
    !nameServers.every((server) => typeof server === 'string' && server.length > 0)
  ) {
    throw new Error(
      `A delegation of the ${environment} environment in cdk.json needs a recordName and its name servers.`,
    );
  }
  return { recordName, nameServers: nameServers as string[] };
}

/** The environment a synth describes, validated field by field. */
export function environmentOf(
  node: ContextReader,
  variables: InstallationVariables = process.env,
): EnvironmentConfig {
  const requested = String(node.tryGetContext('environment') ?? 'production');
  if (!ENVIRONMENT_NAMES.includes(requested as EnvironmentName)) {
    throw new Error(
      `There is no environment called "${requested}". Choose one of: ${ENVIRONMENT_NAMES.join(', ')}.`,
    );
  }
  if (variables['INSTALLATION']?.trim()) {
    return installationEnvironmentOf(requested as EnvironmentName, node, variables);
  }
  const all = node.tryGetContext('environments') as Record<string, unknown> | undefined;
  const raw = all?.[requested] as Record<string, unknown> | undefined;
  if (!raw) throw new Error(`cdk.json declares no "${requested}" under "environments".`);

  const text = (key: string): string => {
    const value = raw[key];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`The ${requested} environment in cdk.json has no "${key}".`);
    }
    return value.trim();
  };

  const account = text('account');
  if (!/^\d{12}$/.test(account)) {
    throw new Error(
      `The ${requested} environment names "${account}" as its account, which is not an account id.`,
    );
  }
  const delegations = Array.isArray(raw['delegations']) ? raw['delegations'] : [];
  if ('alarms' in raw) {
    throw new Error(
      `The ${requested} environment in cdk.json declares "alarms", which a delivery chooses (ADR-021): remove it.`,
    );
  }
  const alarms = choiceOf(node, 'alarms');
  const notified = alarms || requested === 'production';
  const alarmEmail = String(node.tryGetContext('alarmEmail') ?? '').trim();
  if (notified && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alarmEmail)) {
    throw new Error(
      `The ${requested} environment ${alarms ? 'carries alarms' : 'carries the budgets'}, and no address to notify was given. ` +
        'Pass it as -c alarmEmail=…, which deliver takes from ALARM_EMAIL: an alarm is never created with nowhere to go.',
    );
  }
  const repository =
    typeof node.tryGetContext('repository') === 'string'
      ? String(node.tryGetContext('repository'))
      : 'memorysmithapp/memorysmithapp';

  return {
    name: requested as EnvironmentName,
    installation: null,
    account,
    region: text('region'),
    hostedZoneName: text('hostedZoneName'),
    hostedZoneId: text('hostedZoneId'),
    hosts: null,
    delegations: delegations.map((entry) => delegationOf(entry, requested)),
    repository,
    repositoryHost: 'github',
    repositorySubject:
      typeof node.tryGetContext('repositorySubject') === 'string'
        ? String(node.tryGetContext('repositorySubject'))
        : `repo:${repository}`,
    alarms,
    dashboards: choiceOf(node, 'dashboards'),
    tracing: choiceOf(node, 'tracing'),
    ...(notified ? { alarmEmail } : {}),
  };
}
