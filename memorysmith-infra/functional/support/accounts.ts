/**
 * The accounts of a run, and the tokens they sign in with
 * (architecture-guide.md, section 19).
 *
 * A token for the API comes from the admin sign-in of the web client, which
 * allows it for exactly this. The connector refuses such a token, because it
 * accepts only tokens issued to its own proxy client, and those come from the
 * OAuth flow in a browser and nowhere else.
 */

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { workingPassword } from '../../commands/lib/passwords.js';
import type { RunState, TestAccount } from './state.js';

const clients = new Map<string, CognitoIdentityProviderClient>();

function cognitoOf(region: string): CognitoIdentityProviderClient {
  const existing = clients.get(region);
  if (existing) return existing;
  const created = new CognitoIdentityProviderClient({ region });
  clients.set(region, created);
  return created;
}

/** An account with a password nobody keeps, and no message sent anywhere. */
export async function createAccount(input: {
  readonly region: string;
  readonly userPoolId: string;
  readonly email: string;
  readonly platformAdmin: boolean;
}): Promise<{ email: string; password: string }> {
  const cognito = cognitoOf(input.region);
  const password = workingPassword();
  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: input.userPoolId,
      Username: input.email,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: input.email },
        { Name: 'email_verified', Value: 'true' },
      ],
    }),
  );
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: input.userPoolId,
      Username: input.email,
      Password: password,
      Permanent: true,
    }),
  );
  if (input.platformAdmin) {
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: input.userPoolId,
        Username: input.email,
        GroupName: 'platform-admin',
      }),
    );
  }
  return { email: input.email, password };
}

export async function deleteAccount(state: RunState, account: TestAccount): Promise<void> {
  await cognitoOf(state.region)
    .send(new AdminDeleteUserCommand({ UserPoolId: state.userPoolId, Username: account.email }))
    .catch((error: { name?: string }) => {
      if (error.name !== 'UserNotFoundException') throw error;
    });
}

const tokens = new Map<string, { token: string; expiresAt: number }>();

/**
 * An access token of the web client. `fresh` signs in again, which is what a
 * claim changed after the last sign-in needs: a claim is minted with the token.
 */
export async function apiToken(
  state: Pick<RunState, 'region' | 'userPoolId' | 'webClientId'>,
  account: Pick<TestAccount, 'email' | 'password'>,
  fresh = false,
): Promise<string> {
  const cached = tokens.get(account.email);
  if (!fresh && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const answer = await cognitoOf(state.region).send(
    new AdminInitiateAuthCommand({
      UserPoolId: state.userPoolId,
      ClientId: state.webClientId,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: account.email, PASSWORD: account.password },
    }),
  );
  const result = answer.AuthenticationResult;
  if (!result?.AccessToken) {
    throw new Error(`Signing ${account.email} in returned no token (${answer.ChallengeName}).`);
  }
  tokens.set(account.email, {
    token: result.AccessToken,
    expiresAt: Date.now() + (result.ExpiresIn ?? 3600) * 1000,
  });
  return result.AccessToken;
}
