/**
 * A session of the interface, kept the way the interface keeps it
 * (architecture-guide.md, section 19).
 *
 * The web client allows the admin sign-in, so a case signs its account in
 * through the Cognito admin API and writes the tokens where the interface reads
 * them, in the shape it stores them, before the first page loads. One case signs
 * in through the managed login instead, and that is where the browser flow of
 * the interface is proved.
 */

import {
  AdminInitiateAuthCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import type { RunState, TestAccount } from './state.js';

/** `memorysmith.tokens`, as `shared/auth/oauth.ts` writes it: `expiresAt` in epoch milliseconds. */
export interface StoredTokens {
  readonly accessToken: string;
  readonly idToken: string;
  readonly refreshToken: string | null;
  readonly expiresAt: number;
}

export async function webSession(
  state: Pick<RunState, 'region' | 'userPoolId' | 'webClientId'>,
  account: Pick<TestAccount, 'email' | 'password'>,
): Promise<StoredTokens> {
  const answer = await new CognitoIdentityProviderClient({ region: state.region }).send(
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
  return {
    accessToken: result.AccessToken,
    idToken: result.IdToken ?? '',
    refreshToken: result.RefreshToken ?? null,
    expiresAt: Date.now() + (result.ExpiresIn ?? 3600) * 1000,
  };
}
