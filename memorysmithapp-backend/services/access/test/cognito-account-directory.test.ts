/**
 * The password change, against a Cognito that answers in memory (#331): every
 * other session ends, and this one is signed in again only after the second
 * the sign-out revoked up to, or the refresh token it gets is dead on arrival.
 */

import { describe, expect, it } from 'vitest';
import type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { CognitoAccountDirectory } from '../src/adapters/outbound/cognito/CognitoAccountDirectory.js';
import { Email } from '../src/domain/values.js';

const account = (() => {
  const made = Email.create('ana@example.com');
  if (!made.ok) throw new Error(made.error.message);
  return made.value;
})();

describe('changing the password through Cognito', () => {
  it('signs this session in again only after waiting past the second of the sign-out', async () => {
    const steps: string[] = [];
    const cognito = {
      send: async (command: { constructor: { name: string } }) => {
        steps.push(command.constructor.name);
        return command.constructor.name === 'AdminInitiateAuthCommand'
          ? {
              AuthenticationResult: {
                AccessToken: 'access',
                IdToken: 'id',
                RefreshToken: 'refresh',
                ExpiresIn: 3600,
              },
            }
          : {};
      },
    } as unknown as CognitoIdentityProviderClient;
    const directory = new CognitoAccountDirectory('pool', 'client', cognito, async (ms) => {
      steps.push(`pause ${ms}`);
    });

    const changed = await directory.changePassword(account, 'the old one', 'the new one');

    expect(changed.ok && changed.value?.refreshToken).toBe('refresh');
    expect(steps).toEqual([
      'AdminInitiateAuthCommand',
      'AdminSetUserPasswordCommand',
      'AdminUserGlobalSignOutCommand',
      'pause 1100',
      'AdminInitiateAuthCommand',
    ]);
  });
});
