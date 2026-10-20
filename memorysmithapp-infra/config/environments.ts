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
 */

export type EnvironmentName = 'production' | 'staging';

export const ENVIRONMENT_NAMES: readonly EnvironmentName[] = ['production', 'staging'];

/** A zone below this one, delegated by an NS record this environment declares. */
export interface Delegation {
  /** Relative to the zone of this environment, e.g. `stg`. */
  readonly recordName: string;
  /** The four name servers Route 53 drew when that zone was created. */
  readonly nameServers: readonly string[];
}

export interface EnvironmentConfig {
  readonly name: EnvironmentName;
  readonly account: string;
  readonly region: string;
  readonly hostedZoneName: string;
  readonly hostedZoneId: string;
  readonly delegations: readonly Delegation[];
  /** `owner/name`: the repository GitHub Actions delivers from. */
  readonly repository: string;
  /**
   * What the `sub` of a token GitHub signs for that repository starts with.
   * A repository with immutable subjects names its owner and itself with their
   * ids, `repo:owner@123/name@456`, so a repository deleted and created again
   * under the same name is another repository; `repo:owner/name` otherwise.
   */
  readonly repositorySubject: string;
  /**
   * Whether this delivery carries the alarms (#267, ADR-021). What costs money
   * is chosen by the delivery and is off unless it is turned on: the context
   * `alarms`, which `deliver --alarms` passes.
   */
  readonly alarms: boolean;
  /** Whether this delivery draws the dashboards (#270, ADR-021): the context `dashboards`. */
  readonly dashboards: boolean;
  /** Whether this delivery traces its functions through X-Ray (#271, ADR-021): the context `tracing`. */
  readonly tracing: boolean;
  /**
   * Who the alarms and the budgets notify, present in production, which owns
   * the budgets of the account, and wherever `alarms` is on. It arrives as the
   * context `alarmEmail`, which `deliver` takes from the variable `ALARM_EMAIL`
   * of the GitHub environment, and it is never written into cdk.json, because
   * the repository is public.
   */
  readonly alarmEmail?: string;
}

interface ContextReader {
  tryGetContext(key: string): unknown;
}

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

/**
 * A choice of the delivery (ADR-021): off unless the context turns it on, as
 * `true` from a test or the text `true` from `cdk synth -c`.
 */
function choiceOf(node: ContextReader, key: string): boolean {
  const value = node.tryGetContext(key);
  if (value === undefined || value === false || value === 'false') return false;
  if (value === true || value === 'true') return true;
  throw new Error(`The context "${key}" is "${String(value)}": it is true or false.`);
}

/** The environment a synth describes, validated field by field. */
export function environmentOf(node: ContextReader): EnvironmentConfig {
  const requested = String(node.tryGetContext('environment') ?? 'production');
  if (!ENVIRONMENT_NAMES.includes(requested as EnvironmentName)) {
    throw new Error(
      `There is no environment called "${requested}". Choose one of: ${ENVIRONMENT_NAMES.join(', ')}.`,
    );
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
    account,
    region: text('region'),
    hostedZoneName: text('hostedZoneName'),
    hostedZoneId: text('hostedZoneId'),
    delegations: delegations.map((entry) => delegationOf(entry, requested)),
    repository,
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

/** The id of a stack, which says which environment it belongs to. */
export function stackId(environment: Pick<EnvironmentConfig, 'name'>, name: string): string {
  return `Memorysmith${environment.name.charAt(0).toUpperCase()}${environment.name.slice(1)}${name}`;
}

/**
 * A physical name that says which environment it belongs to. The two
 * environments share one account, so a name that did not say it would collide
 * with the other environment's, and nothing read from a console, a log line or
 * a bill could be told apart from the other environment's.
 */
export function physicalName(environment: Pick<EnvironmentConfig, 'name'>, base: string): string {
  return `${base}-${environment.name}`;
}
