/**
 * The two environments this app describes.
 *
 * `-c environment=production|staging` chooses one, and everything that differs
 * between them is read from `environments` in cdk.json: the account, the
 * region, the hosted zone, the zones it delegates and whether it carries
 * alarms. A synth that names no environment is production. The one thing that
 * differs and is not in cdk.json is the address the alarms notify, which is
 * context a delivery passes, because the repository is public.
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
   * Whether this environment carries its alarms (#267). An alarm
   * exists to reach a person, so production carries them and staging, which is
   * disposable and proved by the smoke and the functional suite rather than
   * watched, carries none. Declared per environment in cdk.json, never assumed.
   */
  readonly alarms: boolean;
  /**
   * Who the alarms notify, present exactly when `alarms` is. It arrives as the
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
  const alarms = raw['alarms'];
  if (typeof alarms !== 'boolean') {
    throw new Error(
      `The ${requested} environment in cdk.json does not say whether it carries alarms ("alarms": true or false).`,
    );
  }
  const alarmEmail = String(node.tryGetContext('alarmEmail') ?? '').trim();
  if (alarms && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alarmEmail)) {
    throw new Error(
      `The ${requested} environment carries alarms, and no address to notify was given. ` +
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
    ...(alarms ? { alarmEmail } : {}),
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
