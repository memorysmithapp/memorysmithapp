/**
 * An installation of somebody else (#342): one environment, read from
 * variables and never from cdk.json, which keeps only the project's own.
 *
 * On the command path the variables live in `.env.<environment>` beside
 * cdk.json; on a fork they are variables of the GitHub or GitLab environment.
 * `.env.example` documents every name. Nothing here falls back to a value of
 * `memorysmith.app`, so an installation can never deliver over it by leaving a
 * name out.
 *
 * It lives apart from `config/` because the commands read it too, and a command
 * imports no part of the app: what an environment is and how it is named is the
 * one thing both sides need, and here it imports neither.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export type EnvironmentName = 'production' | 'staging';

/** A zone below this one, delegated by an NS record this environment declares. */
export interface Delegation {
  /** Relative to the zone of this environment, e.g. `stg`. */
  readonly recordName: string;
  /** The four name servers Route 53 drew when that zone was created. */
  readonly nameServers: readonly string[];
}

/** Where an installation with no hosted zone answers: the names AWS gave it. */
export interface DefaultHosts {
  readonly site: string;
  readonly api: string;
  readonly mcp: string;
  readonly uploads: string;
  readonly files: string;
}

export type RepositoryHost = 'github' | 'gitlab' | 'none';

/** How a person signs in where the organization declares its provider (#395). */
export type SignIn = 'idp' | 'idp+password';
/** What a person of the provider finds on their first sign-in (#395). */
export type FirstSignIn = 'request' | 'prepared' | 'automatic';

/**
 * The organization's own SMTP relay, which every message of the installation
 * leaves through when `MAIL=smtp` (#396). Its password is never here:
 * `deliver` writes it into Secrets Manager and the function reads it.
 */
export interface RelayConfig {
  readonly host: string;
  readonly port: number;
  /** Null for a relay that takes mail from inside its network without a login. */
  readonly user: string | null;
  /** The address the relay accepts as the sender. */
  readonly sender: string;
  /** Subnets of a VPC that reaches the relay, and KMS; empty over the Internet. */
  readonly subnetIds: readonly string[];
  readonly securityGroupIds: readonly string[];
}

/**
 * The identity provider of the organization, federated into the pool over
 * OIDC (#395, ADR-026). Its client secret is never here: `deliver` writes it
 * into Secrets Manager and the template only references it.
 */
export interface IdentityProviderConfig {
  /** The name the sign-in page shows and Cognito keys the provider by. */
  readonly name: string;
  readonly issuer: string;
  readonly clientId: string;
  /** The claim the address of the person travels in: `email`, or `preferred_username`. */
  readonly emailClaim: string;
  /** Whether an address the provider does not assert as verified is taken anyway. */
  readonly trustEmail: boolean;
  readonly signIn: SignIn;
  readonly firstSignIn: FirstSignIn;
  /** The quota of a subscription the first sign-in gives, under `automatic`. */
  readonly quota: string | null;
  /** The version of the secret `deliver` wrote, so that a new secret changes the template. */
  readonly secretVersion: string | null;
}

export interface EnvironmentConfig {
  readonly name: EnvironmentName;
  /** Whose installation this is, or null for the project's own, `memorysmith.app`. */
  readonly installation: string | null;
  readonly account: string;
  readonly region: string;
  /** Null on the default endpoints of AWS, where `hosts` says where it answers. */
  readonly hostedZoneName: string | null;
  readonly hostedZoneId: string | null;
  readonly hosts: DefaultHosts | null;
  readonly delegations: readonly Delegation[];
  /** `owner/name`: the repository the pipeline delivers from. */
  readonly repository: string;
  /** Which forge that repository lives on, `none` for the command path. */
  readonly repositoryHost: RepositoryHost;
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
  /** Who the product writes from without a domain of its own: an address verified in SES. */
  readonly senderAddress?: string;
  /** The OIDC provider of the account an installation trusts, which no stack of it owns. */
  readonly oidcProviderArn?: string;
  /** The issuer of the tokens of a GitLab pipeline, gitlab.com or a host of its own. */
  readonly oidcIssuer?: string;
  /** The organization's identity provider, when the installation declares one (#395). */
  readonly identityProvider?: IdentityProviderConfig;
  /** The organization's relay, when the installation sends through it instead of SES (#396). */
  readonly relay?: RelayConfig;
}

export type InstallationVariables = Readonly<Record<string, string | undefined>>;

export interface ContextReader {
  tryGetContext(key: string): unknown;
}

/**
 * A choice of the delivery (ADR-021): off unless the context turns it on, as
 * `true` from a test or the text `true` from `cdk synth -c`.
 */
export function choiceOf(node: ContextReader, key: string): boolean {
  const value = node.tryGetContext(key);
  if (value === undefined || value === false || value === 'false') return false;
  if (value === true || value === 'true') return true;
  throw new Error(`The context "${key}" is "${String(value)}": it is true or false.`);
}

/** Where the hosts of the default endpoints are until the first delivery has read them. */
export const PENDING_HOSTS: DefaultHosts = {
  site: 'pending-site.example.com',
  api: 'pending-api.example.com',
  mcp: 'pending-mcp.example.com',
  uploads: 'pending-uploads.example.com',
  files: 'pending-files.example.com',
};

/** Loads `.env.<environment>` beside cdk.json; a variable already set wins over the file. */
export function loadInstallationFile(environment: string): void {
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', `.env.${environment}`);
  if (existsSync(file)) process.loadEnvFile(file);
}

function delegationsOf(raw: string): Delegation[] {
  return raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [recordName, servers] = entry.split(':');
      const nameServers = (servers ?? '').split(',').map((server) => server.trim());
      if (!recordName || nameServers.some((server) => server === '')) {
        throw new Error(
          `DNS_DELEGATIONS holds "${entry}": write it as stg:ns-1.awsdns-01.org,ns-2.awsdns-02.com.`,
        );
      }
      return { recordName, nameServers };
    });
}

function hostsOf(node: ContextReader): DefaultHosts {
  const raw = node.tryGetContext('defaultHosts');
  if (raw === undefined) return PENDING_HOSTS;
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as DefaultHosts;
}

/** The secret that holds the client secret of the organization's provider. */
export function identityProviderSecretName(environment: Named): string {
  return physicalName(environment, 'memorysmith-idp-client-secret');
}

/** The secret that holds the password of the organization's relay. */
export function relaySecretName(environment: Named): string {
  return physicalName(environment, 'memorysmith-smtp-password');
}

/**
 * Every secret `deliver` may have written for this environment, which
 * `destroy-installation` deletes with it: no stack owns them.
 */
export function deliverySecretNames(environment: Named): string[] {
  return [identityProviderSecretName(environment), relaySecretName(environment)];
}

const listOf = (raw: string): string[] =>
  raw
    .split(',')
    .map((each) => each.trim())
    .filter(Boolean);

/**
 * Which service sends the e-mail of the installation (#396): SES, the
 * default, or the organization's relay, read from the SMTP_ variables. A
 * relay variable with no relay chosen is refused, since it would be ignored.
 */
export function relayOf(value: (key: string) => string): RelayConfig | null {
  const service = value('MAIL') || 'ses';
  if (!['ses', 'smtp'].includes(service)) {
    throw new Error(`MAIL is "${service}": it is ses or smtp.`);
  }
  const relayed = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'MAIL_SUBNET_IDS',
    'MAIL_SECURITY_GROUP_IDS',
  ];
  if (service === 'ses') {
    const stray = relayed.filter((key) => value(key) !== '');
    if (stray.length > 0) {
      throw new Error(
        `${stray.join(', ')} ${stray.length === 1 ? 'is' : 'are'} set, and MAIL is not smtp: set MAIL=smtp to send through the relay.`,
      );
    }
    return null;
  }

  const host = value('SMTP_HOST');
  if (!/^[A-Za-z0-9.-]+$/.test(host)) {
    throw new Error(
      host === ''
        ? 'MAIL=smtp names no SMTP_HOST: see .env.example.'
        : `SMTP_HOST is "${host}", which is not a host name.`,
    );
  }
  const port = Number(value('SMTP_PORT') || '587');
  if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 25) {
    throw new Error(
      `SMTP_PORT is "${value('SMTP_PORT')}": 587 for STARTTLS or 465 for TLS; port 25 is not used, since AWS throttles it.`,
    );
  }
  const sender = value('SENDER_ADDRESS');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sender)) {
    throw new Error('MAIL=smtp needs SENDER_ADDRESS: the address the relay accepts as the sender.');
  }
  const subnetIds = listOf(value('MAIL_SUBNET_IDS'));
  const securityGroupIds = listOf(value('MAIL_SECURITY_GROUP_IDS'));
  if ((subnetIds.length === 0) !== (securityGroupIds.length === 0)) {
    throw new Error(
      'MAIL_SUBNET_IDS and MAIL_SECURITY_GROUP_IDS go together: name both to reach the relay from inside a VPC, and neither to reach it over the Internet.',
    );
  }
  if (
    ![...subnetIds, ...securityGroupIds].every((id) =>
      /^(subnet|sg)-([0-9a-f]{8}|[0-9a-f]{17})$/.test(id),
    )
  ) {
    throw new Error(
      'MAIL_SUBNET_IDS holds subnet ids and MAIL_SECURITY_GROUP_IDS security group ids.',
    );
  }
  return { host, port, user: value('SMTP_USER') || null, sender, subnetIds, securityGroupIds };
}

/**
 * The organization's provider, read from the IDP_ variables, or null when the
 * installation declares none. Half a declaration is refused, naming what is
 * missing, because a pool that half-trusts a provider is a sign-in that fails
 * only once somebody tries it.
 */
export function identityProviderOf(
  node: ContextReader,
  value: (key: string) => string,
): IdentityProviderConfig | null {
  const named = ['IDP_NAME', 'IDP_ISSUER', 'IDP_CLIENT_ID'];
  const declared = named.filter((key) => value(key) !== '');
  const choices = [
    'SIGN_IN',
    'IDP_FIRST_SIGN_IN',
    'IDP_EMAIL_CLAIM',
    'IDP_TRUST_EMAIL',
    'IDP_QUOTA',
  ];
  if (declared.length === 0) {
    const stray = choices.filter((key) => value(key) !== '');
    if (stray.length > 0) {
      throw new Error(
        `${stray.join(', ')} ${stray.length === 1 ? 'is' : 'are'} set, and no identity provider is declared: set IDP_NAME, IDP_ISSUER and IDP_CLIENT_ID.`,
      );
    }
    return null;
  }
  const missing = named.filter((key) => value(key) === '');
  if (missing.length > 0) {
    throw new Error(`The identity provider names no ${missing.join(', ')}: see .env.example.`);
  }

  const name = value('IDP_NAME');
  // Cognito keys a provider by this name, which holds no space and no underscore.
  if (!/^[^\s_]{3,32}$/u.test(name)) {
    throw new Error(
      `IDP_NAME is "${name}": 3 to 32 characters, with no space and no underscore, since Cognito keys the provider by it.`,
    );
  }
  const issuer = value('IDP_ISSUER').replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/]+(\/\S*)?$/.test(issuer)) {
    throw new Error(
      `IDP_ISSUER is "${issuer}": the https address of the realm, e.g. https://sso.example.com/realms/acme.`,
    );
  }
  const signIn = (value('SIGN_IN') || 'idp+password') as SignIn;
  if (!['idp', 'idp+password'].includes(signIn)) {
    throw new Error(`SIGN_IN is "${signIn}": it is idp or idp+password.`);
  }
  const firstSignIn = (value('IDP_FIRST_SIGN_IN') || 'request') as FirstSignIn;
  if (!['request', 'prepared', 'automatic'].includes(firstSignIn)) {
    throw new Error(`IDP_FIRST_SIGN_IN is "${firstSignIn}": it is request, prepared or automatic.`);
  }
  const emailClaim = value('IDP_EMAIL_CLAIM') || 'email';
  if (!/^[A-Za-z_][\w.:-]{0,63}$/.test(emailClaim)) {
    throw new Error(`IDP_EMAIL_CLAIM is "${emailClaim}", which is not the name of a claim.`);
  }
  const trust = value('IDP_TRUST_EMAIL') || 'false';
  if (!['true', 'false'].includes(trust)) {
    throw new Error(`IDP_TRUST_EMAIL is "${trust}": it is true or false.`);
  }
  const quota = value('IDP_QUOTA');
  if (quota !== '' && firstSignIn !== 'automatic') {
    throw new Error(
      'IDP_QUOTA is the quota of the subscription a first sign-in gives, and only IDP_FIRST_SIGN_IN=automatic gives one.',
    );
  }
  // The quotas a subscription may hold, as the Access service names them.
  if (quota !== '' && !['500MB', '1GB', '2GB'].includes(quota)) {
    throw new Error(`IDP_QUOTA is "${quota}": it is 500MB, 1GB or 2GB.`);
  }
  const version = String(node.tryGetContext('idpSecretVersion') ?? '').trim();

  return {
    name,
    issuer,
    clientId: value('IDP_CLIENT_ID'),
    emailClaim,
    trustEmail: trust === 'true',
    signIn,
    firstSignIn,
    quota: quota || null,
    secretVersion: version || null,
  };
}

/** The environment of an installation, validated name by name. */
export function installationEnvironmentOf(
  name: EnvironmentName,
  node: ContextReader,
  variables: InstallationVariables,
): EnvironmentConfig {
  const value = (key: string): string => variables[key]?.trim() ?? '';
  const required = (key: string): string => {
    const found = value(key);
    if (found === '') {
      throw new Error(`The installation names no ${key}: see .env.example.`);
    }
    return found;
  };

  const installation = required('INSTALLATION');
  if (!/^[a-z][a-z0-9-]{0,15}$/.test(installation) || /aws|amazon|cognito/.test(installation)) {
    throw new Error(
      `INSTALLATION is "${installation}": up to 16 lowercase letters, digits and hyphens, starting with a letter, ` +
        'and without aws, amazon or cognito, which a sign-in domain refuses.',
    );
  }
  const account = required('AWS_ACCOUNT_ID');
  if (!/^\d{12}$/.test(account)) {
    throw new Error(`AWS_ACCOUNT_ID is "${account}", which is not an account id.`);
  }
  const domain = value('DOMAIN_NAME');
  const zoneId = value('HOSTED_ZONE_ID');
  if ((domain === '') !== (zoneId === '')) {
    throw new Error(
      'DOMAIN_NAME and HOSTED_ZONE_ID go together: name both for a domain of your own, and neither for the default endpoints of AWS.',
    );
  }
  const repositoryHost = (value('REPOSITORY_HOST') || 'none') as RepositoryHost;
  if (!['github', 'gitlab', 'none'].includes(repositoryHost)) {
    throw new Error(`REPOSITORY_HOST is "${repositoryHost}": it is github, gitlab or none.`);
  }
  const repository = repositoryHost === 'none' ? '' : required('REPOSITORY');
  const alarms = choiceOf(node, 'alarms');
  const notified = alarms || name === 'production';
  const alarmEmail = String(node.tryGetContext('alarmEmail') ?? value('ALARM_EMAIL')).trim();
  if (notified && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alarmEmail)) {
    throw new Error(
      `The ${name} environment ${alarms ? 'carries alarms' : 'carries the budgets'}, and ALARM_EMAIL names nobody to notify.`,
    );
  }
  const sender = value('SENDER_ADDRESS');
  const oidcProviderArn = String(node.tryGetContext('oidcProviderArn') ?? '');
  const oidcIssuer = value('GITLAB_ISSUER') || 'gitlab.com';
  const identityProvider = identityProviderOf(node, value);
  const relay = relayOf(value);

  return {
    name,
    installation,
    account,
    region: required('AWS_REGION'),
    hostedZoneName: domain || null,
    hostedZoneId: zoneId || null,
    hosts: domain ? null : hostsOf(node),
    delegations: delegationsOf(value('DNS_DELEGATIONS')),
    repository,
    repositoryHost,
    repositorySubject: value('REPOSITORY_SUBJECT') || `repo:${repository}`,
    alarms,
    dashboards: choiceOf(node, 'dashboards'),
    tracing: choiceOf(node, 'tracing'),
    ...(notified ? { alarmEmail } : {}),
    ...(sender ? { senderAddress: sender } : {}),
    ...(oidcProviderArn ? { oidcProviderArn } : {}),
    oidcIssuer,
    ...(identityProvider ? { identityProvider } : {}),
    ...(relay ? { relay } : {}),
  };
}

type Named = Pick<EnvironmentConfig, 'name'> & Partial<Pick<EnvironmentConfig, 'installation'>>;

const pascal = (text: string): string =>
  text
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

/** The id of a stack, which says which installation and environment it belongs to. */
export function stackId(environment: Named, name: string): string {
  return `Memorysmith${pascal(environment.installation ?? '')}${pascal(environment.name)}${name}`;
}

/**
 * A physical name that says which environment it belongs to. The two
 * environments share one account, so a name that did not say it would collide
 * with the other environment's, and nothing read from a console, a log line or
 * a bill could be told apart from the other environment's. An installation
 * joins the name for the same reason, and the project's own keeps the names it
 * has, because renaming a table or a user pool replaces it.
 */
export function physicalName(environment: Named, base: string): string {
  return environment.installation
    ? `${base}-${environment.installation}-${environment.name}`
    : `${base}-${environment.name}`;
}

/** The issuer of the tokens GitHub Actions signs. */
export const GITHUB_ISSUER = 'token.actions.githubusercontent.com';

/**
 * What `sub` and `aud` a role of an environment of an installation trusts.
 *
 * GitHub names the environment in the subject. GitLab does not: its subject
 * ends in the branch, so production trusts `main` alone and staging any branch
 * of the project, and what keeps production safe there is that `main` is
 * protected.
 */
export function trustOf(environment: EnvironmentConfig): {
  readonly issuer: string;
  readonly audience: string;
  readonly subject: string;
} {
  if (environment.repositoryHost === 'gitlab') {
    const issuer = environment.oidcIssuer ?? 'gitlab.com';
    const branch = environment.name === 'production' ? 'main' : '*';
    return {
      issuer,
      audience: `https://${issuer}`,
      subject: `project_path:${environment.repository}:ref_type:branch:ref:${branch}`,
    };
  }
  return {
    issuer: GITHUB_ISSUER,
    audience: 'sts.amazonaws.com',
    subject: `${environment.repositorySubject}:environment:${environment.name}`,
  };
}
