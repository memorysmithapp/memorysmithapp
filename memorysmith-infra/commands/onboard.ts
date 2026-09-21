/**
 * Creates an account and gives it a subscription (architecture-guide.md,
 * section 20).
 *
 *   pnpm -C memorysmith-infra onboard --environment staging [--email ana@example.com]
 *     [--name Ana] [--quota 1GB] [--status active] [--set-password] [--locale en_US]
 *
 * A deploy seeds nothing: the user pool comes up empty, and no subscription is
 * written behind the rule that a person asks for one and a platform admin
 * approves it (RN-SUB-001, RN-SUB-006). On a new environment that leaves nobody
 * to sign in as, and nobody who could approve anything. This closes that loop,
 * with credentials of the account of the environment and never by hand: it
 * creates the account in Cognito, signs in as it, asks for the subscription and
 * puts it in the status chosen. The account starts with no notebook: designing
 * one is the work of whoever uses it, or of an agent following the skills the
 * connector serves.
 *
 * THE FIRST ACCOUNT OF AN EMPTY POOL BECOMES A PLATFORM ADMIN, and only the
 * first: somebody has to be able to authorize the very first subscription.
 *
 * THE ACCOUNT IS HANDED OVER WITH A PROVISIONAL PASSWORD. The subscription is
 * requested as the account, so this signs in with a password of its own that
 * nobody sees, and at the end it leaves the account waiting for its first
 * password: Cognito e-mails an invitation, and whoever runs this never learns
 * the password of somebody else's account. `--set-password` types a permanent
 * one here instead, and sends no e-mail.
 */

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminListGroupsForUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ListUsersInGroupCommand,
  type AdminGetUserCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { workingPassword } from './lib/passwords.js';
import { ProductApi } from './lib/product-api.js';
import { readText } from './lib/repository.js';

const QUOTAS = ['500MB', '1GB', '2GB'];
const STATUSES = ['pending_approval', 'trial', 'active', 'rejected', 'suspended', 'canceled'];
const OPERATIONAL = ['trial', 'active'];

const { values } = parseArgs({
  options: {
    environment: { type: 'string', default: 'staging' },
    email: { type: 'string' },
    name: { type: 'string' },
    quota: { type: 'string' },
    status: { type: 'string' },
    'set-password': { type: 'boolean', default: false },
    locale: { type: 'string' },
  },
});

/**
 * The language every message to the account is written in (RN-ACC-018): the
 * invitation this sends, and every code after it until the person chooses
 * another in the interface. `pt_BR` when none is given, the default of the
 * interface too.
 */
const LOCALES = ['pt_BR', 'en_US'];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const say = (line: string): void => void process.stdout.write(`${line}\n`);

// ---- Asking ------------------------------------------------------------------

const prompts = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

async function ask(question: string, fallback?: string): Promise<string> {
  const suffix = fallback ? ` (${fallback})` : '';
  const answer = (await prompts.question(`  ${question}${suffix}: `)).trim();
  return answer || fallback || '';
}

/** A password, typed without echo. */
async function askSecret(question: string): Promise<string> {
  const output = prompts as unknown as { _writeToOutput: (chunk: string) => void };
  const original = output._writeToOutput.bind(prompts);
  let muted = false;
  output._writeToOutput = (chunk) => {
    if (!muted) original(chunk);
  };
  const pending = prompts.question(`  ${question}: `);
  muted = true;
  const answer = await pending;
  output._writeToOutput = original;
  process.stdout.write('\n');
  return answer;
}

async function choose(question: string, options: readonly string[], fallback: string) {
  const answer = await ask(`${question} [${options.join(', ')}]`, fallback);
  if (!options.includes(answer)) fail(`"${answer}" is not one of ${options.join(', ')}.`);
  return answer;
}

// ---- What is being created ---------------------------------------------------

const environment = values.environment;
const environments = (
  JSON.parse(readText('memorysmith-infra/cdk.json')) as {
    context: { environments: Record<string, { hostedZoneName: string }> };
  }
).context.environments;
const zone =
  environments[environment]?.hostedZoneName ?? fail(`There is no environment "${environment}".`);

const email = (values.email ?? (await ask('e-mail of the account'))).toLowerCase();
if (!email) fail('No account to onboard: pass --email.');
const quota = values.quota ?? (await choose('storage quota', QUOTAS, '1GB'));
const status = values.status ?? (await choose('subscription status', STATUSES, 'active'));
if (!QUOTAS.includes(quota) || !STATUSES.includes(status)) fail('Unknown quota or status.');
const locale = values.locale ?? 'pt_BR';
if (!LOCALES.includes(locale)) fail(`"${locale}" is not one of ${LOCALES.join(', ')}.`);

// ---- The environment ---------------------------------------------------------

const stackName = `Memorysmith${environment.charAt(0).toUpperCase()}${environment.slice(1)}Identity`;
const described = await new CloudFormationClient({}).send(
  new DescribeStacksCommand({ StackName: stackName }),
);
const outputs = Object.fromEntries(
  (described.Stacks?.[0]?.Outputs ?? []).map((output) => [output.OutputKey, output.OutputValue]),
);
const userPoolId = outputs['UserPoolId'] ?? fail(`${stackName} has no UserPoolId output.`);
const clientId = outputs['WebClientId'] ?? fail(`${stackName} has no WebClientId output.`);
const api = new ProductApi(`https://api.${zone}`);
const cognito = new CognitoIdentityProviderClient({});

say(`\nEnvironment ${environment}: https://api.${zone}, user pool ${userPoolId}`);

async function signIn(username: string, password: string): Promise<string> {
  const auth = await cognito.send(
    new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }),
  );
  if (auth.ChallengeName) {
    fail(
      `Cognito answered the challenge ${auth.ChallengeName}. Finish it at https://auth.${zone} and run this again.`,
    );
  }
  return auth.AuthenticationResult?.AccessToken ?? fail('Signing in returned no access token.');
}

// ---- The account in Cognito --------------------------------------------------

const existing: AdminGetUserCommandOutput | null = await cognito
  .send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email }))
  .catch((error: { name?: string }) => {
    if (error.name === 'UserNotFoundException') return null;
    throw error;
  });

/**
 * An account that never set a password is one nobody holds: it came out of an
 * invitation and stopped there, which is also what a run interrupted halfway
 * leaves. Taking it over is how a second run finishes what the first started.
 * An account in any other state belongs to a person, and the only way in is
 * the password that person has.
 */
const unclaimed = ['FORCE_CHANGE_PASSWORD', 'RESET_REQUIRED'];
const claimed = existing !== null && !unclaimed.includes(existing.UserStatus ?? '');
const handOver = !values['set-password'] && !claimed;
let password: string;

if (claimed) {
  say(`${email} already exists.`);
  password = await askSecret(`password for ${email}`);
} else {
  if (!existing) {
    const attributes = [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'locale', Value: locale },
      ...(values.name ? [{ Name: 'name', Value: values.name }] : []),
    ];
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        MessageAction: 'SUPPRESS',
        UserAttributes: attributes,
      }),
    );
  }
  password = values['set-password']
    ? await askSecret(`new password for ${email}`)
    : workingPassword();
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: email,
      Password: password,
      Permanent: true,
    }),
  );
  say(`${email} is ready.`);
}

// ---- Who authorizes ----------------------------------------------------------

const groups = await cognito.send(
  new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: email }),
);
let isAdmin = (groups.Groups ?? []).some((group) => group.GroupName === 'platform-admin');
if (!isAdmin) {
  const members = await cognito.send(
    new ListUsersInGroupCommand({ UserPoolId: userPoolId, GroupName: 'platform-admin', Limit: 1 }),
  );
  if ((members.Users ?? []).length === 0) {
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: email,
        GroupName: 'platform-admin',
      }),
    );
    isAdmin = true;
    say(`${email} is the first account of this pool, so it operates the platform.`);
  }
}

// ---- The subscription --------------------------------------------------------

interface Session {
  user: { isPlatformAdmin: boolean };
  subscriptions: Array<{ subscriptionId: string; isOwner: boolean }>;
}

const token = await signIn(email, password);
const session = await api.call<Session>('GET', '/access/session', token);

let adminToken = token;
if (!session.user.isPlatformAdmin) {
  const adminEmail = await ask('e-mail of a platform admin');
  adminToken = await signIn(adminEmail, await askSecret(`password for ${adminEmail}`));
  const adminSession = await api.call<Session>('GET', '/access/session', adminToken);
  if (!adminSession.user.isPlatformAdmin) fail(`${adminEmail} is not a platform admin either.`);
}

// A subscription this account already holds is reused: asking twice would
// leave two in the queue, and only one would ever be entered.
const owned = session.subscriptions.find((link) => link.isOwner);
const subscriptionId =
  owned?.subscriptionId ??
  (
    await api.call<{ subscriptionId: string }>('POST', '/access/subscriptions', token, {
      type: 'individual',
      quota,
    })
  ).subscriptionId;

// The status is set through the administrative override (RN-SUB-018), which is
// what lets it be any of the six, a status the transition machine would refuse
// included.
await api.call('PUT', `/access/platform/subscriptions/${subscriptionId}/status`, adminToken, {
  status,
});
await api.call('PATCH', `/access/platform/subscriptions/${subscriptionId}/plan`, adminToken, {
  type: 'individual',
  quota,
});
say(`Subscription ${subscriptionId}: ${status}, ${quota}.`);

// ---- Handing the account over ------------------------------------------------

if (handOver) {
  /**
   * An invitation goes only to an account that never set a password, so a
   * temporary one moves it into that state, and the send mints another for the
   * message itself. The one set here dies the moment the message leaves.
   */
  const temporary = workingPassword();
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: email,
      Password: temporary,
      Permanent: false,
    }),
  );
  const sent = await cognito
    .send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        MessageAction: 'RESEND',
      }),
    )
    .then(() => true)
    .catch(() => false);
  say(
    sent
      ? `An invitation with a provisional password was sent to ${email}.`
      : `The pool did not send the invitation. Hand this provisional password over by another route: ${temporary}`,
  );
}

say(`\n${email}${isAdmin ? ' (platform admin)' : ''} can sign in at https://${zone}.`);
if (!OPERATIONAL.includes(status)) {
  say(`Its subscription is ${status}, which grants no operational access to anyone.`);
}
prompts.close();
