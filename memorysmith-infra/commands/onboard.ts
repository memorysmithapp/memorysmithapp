/**
 * Creates an account, gives it a subscription and fills its first notebook
 * (architecture-guide.md, section 20).
 *
 *   pnpm -C memorysmith-infra onboard --environment staging [--email ana@example.com]
 *     [--name Ana] [--quota 1GB] [--status active] [--notebook enologia]
 *     [--notebook-name "Enologia"] [--structure-only] [--max-notes 50]
 *     [--set-password] [--preview]
 *
 * A deploy seeds nothing: the user pool comes up empty, and no subscription is
 * written behind the rule that a person asks for one and a platform admin
 * approves it (RN-SUB-001, RN-SUB-006). On a new environment that leaves nobody
 * to sign in as, and nobody who could approve anything. This closes that loop,
 * with credentials of the account of the environment and never by hand: it
 * creates the account in Cognito, signs in as it, asks for the subscription,
 * puts it in the status chosen, and writes a whole notebook through the product
 * API from a tree of the example notebooks.
 *
 * THE FIRST ACCOUNT OF AN EMPTY POOL BECOMES A PLATFORM ADMIN, and only the
 * first: somebody has to be able to authorize the very first subscription.
 *
 * THE ACCOUNT IS HANDED OVER WITH A PROVISIONAL PASSWORD. The subscription and
 * the notebook are written as the account, so this signs in with a password of
 * its own that nobody sees, and at the end it leaves the account waiting for its
 * first password: Cognito e-mails an invitation, and whoever runs this never
 * learns the password of somebody else's account. `--set-password` types a
 * permanent one here instead, and sends no e-mail.
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
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { countTree, readNotebookTree, type TreeFolder } from './lib/notebook-tree.js';
import { workingPassword } from './lib/passwords.js';
import { ProductApi } from './lib/product-api.js';
import { readText, REPOSITORY_ROOT } from './lib/repository.js';

const QUOTAS = ['500MB', '1GB', '2GB'];
const STATUSES = ['pending_approval', 'trial', 'active', 'rejected', 'suspended', 'canceled'];
const OPERATIONAL = ['trial', 'active'];
const NOTEBOOKS = join(REPOSITORY_ROOT, 'notebooks', 'trees');

const { values } = parseArgs({
  options: {
    environment: { type: 'string', default: 'staging' },
    email: { type: 'string' },
    name: { type: 'string' },
    quota: { type: 'string' },
    status: { type: 'string' },
    notebook: { type: 'string' },
    'notebook-name': { type: 'string' },
    'structure-only': { type: 'boolean', default: false },
    'max-notes': { type: 'string', default: '0' },
    'set-password': { type: 'boolean', default: false },
    preview: { type: 'boolean', default: false },
  },
});

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

const available = existsSync(NOTEBOOKS)
  ? readdirSync(NOTEBOOKS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  : [];

const notebookSlug =
  values.notebook ??
  (await choose('notebook to write', [...available, 'none'], available[0] ?? 'none'));
if (notebookSlug !== 'none' && !available.includes(notebookSlug)) {
  fail(`There is no notebook called "${notebookSlug}". Available: ${available.join(', ')}.`);
}
const tree =
  notebookSlug === 'none' ? null : readNotebookTree(join(NOTEBOOKS, notebookSlug), notebookSlug);
const maxNotes = Number(values['max-notes']);

if (values.preview) {
  if (!tree) fail('Nothing to preview: no notebook was chosen.');
  const print = (folders: readonly TreeFolder[], depth: number): void => {
    for (const folder of folders) {
      const marks = [
        folder.template ? 'Template' : '',
        folder.notes.length ? `${folder.notes.length} note(s)` : '',
      ]
        .filter(Boolean)
        .join(', ');
      say(`${'  '.repeat(depth + 1)}${folder.title}${marks ? `  [${marks}]` : ''}`);
      print(folder.children, depth + 1);
    }
  };
  say(`The notebook "${values['notebook-name'] ?? tree.name}" would be written as:`);
  if (tree.guidance) say(`  Guidance, ${tree.guidance.length} characters`);
  print(tree.folders, 0);
  const counted = countTree(tree.folders);
  say(`${counted.folders} folder(s), ${counted.notes} note(s). Nothing was created.`);
  if (tree.orphanNotes > 0)
    say(`${tree.orphanNotes} note(s) at the root of the tree would be skipped.`);
  prompts.close();
  process.exit(0);
}

const email = (values.email ?? (await ask('e-mail of the account'))).toLowerCase();
if (!email) fail('No account to onboard: pass --email.');
const quota = values.quota ?? (await choose('storage quota', QUOTAS, '1GB'));
const status = values.status ?? (await choose('subscription status', STATUSES, 'active'));
if (!QUOTAS.includes(quota) || !STATUSES.includes(status)) fail('Unknown quota or status.');

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

let token = await signIn(email, password);
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

/**
 * Writing the notebook needs a subscription that grants operational access
 * (RN-SUB-007), and the status asked for may not be one. So the notebook is
 * written under `active` and the chosen status is applied last, both through
 * the administrative override (RN-SUB-018).
 */
const workingStatus = tree && !OPERATIONAL.includes(status) ? 'active' : status;
await api.call('PUT', `/access/platform/subscriptions/${subscriptionId}/status`, adminToken, {
  status: workingStatus,
});
await api.call('PATCH', `/access/platform/subscriptions/${subscriptionId}/plan`, adminToken, {
  type: 'individual',
  quota,
});
say(`Subscription ${subscriptionId}: ${workingStatus}, ${quota}.`);

// ---- The notebook ------------------------------------------------------------

let written = { folders: 0, notes: 0 };
if (tree) {
  // The claim is minted with the token, so the session that writes is a new one.
  token = await signIn(email, password);
  const notebook = await api.call<{ notebookId: string }>('POST', '/knowledge/notebooks', token, {
    name: values['notebook-name'] ?? tree.name,
    description: '',
  });
  if (tree.guidance) {
    await api.call('PUT', `/knowledge/notebooks/${notebook.notebookId}/guidance`, token, {
      content: tree.guidance,
      baseRevision: null,
    });
  }

  const writeFolders = async (folders: readonly TreeFolder[], parentFolderId: string | null) => {
    for (const folder of folders) {
      const created = await api.call<{ folderId: string }>(
        'POST',
        `/knowledge/notebooks/${notebook.notebookId}/folders`,
        token,
        { parentFolderId, name: folder.title, description: folder.description },
      );
      written = { ...written, folders: written.folders + 1 };
      if (folder.template) {
        await api.call(
          'PUT',
          `/knowledge/notebooks/${notebook.notebookId}/folders/${created.folderId}/template`,
          token,
          { content: folder.template, baseRevision: null },
        );
      }
      if (!values['structure-only']) {
        for (const note of folder.notes) {
          if (maxNotes > 0 && written.notes >= maxNotes) break;
          // The content exactly as the tree carries it: nothing is derived from
          // a file name, and a note written without name: has no name.
          await api.call('POST', `/knowledge/notebooks/${notebook.notebookId}/notes`, token, {
            folderId: created.folderId,
            content: note.content,
          });
          written = { ...written, notes: written.notes + 1 };
          if (written.notes % 25 === 0) say(`  ${written.notes} notes written`);
        }
      }
      await writeFolders(folder.children, created.folderId);
    }
  };
  await writeFolders(tree.folders, null);
  say(`Notebook ${notebook.notebookId}: ${written.folders} folder(s), ${written.notes} note(s).`);
  if (tree.orphanNotes > 0)
    say(`${tree.orphanNotes} note(s) at the root of the tree were skipped.`);
}

if (workingStatus !== status) {
  await api.call('PUT', `/access/platform/subscriptions/${subscriptionId}/status`, adminToken, {
    status,
  });
  say(`Subscription ${subscriptionId}: ${status}.`);
}

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
