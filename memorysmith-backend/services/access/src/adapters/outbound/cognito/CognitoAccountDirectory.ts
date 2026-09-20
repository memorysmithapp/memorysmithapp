/**
 * The account as Cognito keeps it (architecture-guide.md, section 8.5).
 *
 * The language is the standard attribute `locale`, because the trigger that
 * writes the messages of the pool receives the attributes of the account with
 * every message and reads nothing else (RN-ACC-018). The name is the standard
 * attribute `name`, which is the one the token already carries and every
 * screen already shows.
 */

import {
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { DomainError, err, ok, type Result } from '@memorysmith/kernel';
import type { AccountDirectory } from '../../../domain/ports/index.js';
import type { AccountLocale, Email, PersonName } from '../../../domain/values.js';

export class CognitoAccountDirectory implements AccountDirectory {
  constructor(
    private readonly userPoolId: string,
    /** The app client of the interface, which the current password is proved against. */
    private readonly clientId: string,
    private readonly cognito: CognitoIdentityProviderClient = new CognitoIdentityProviderClient({}),
  ) {}

  async setLocale(account: Email, locale: AccountLocale): Promise<void> {
    // The e-mail is an alias of the account, which the admin API accepts in
    // place of the username.
    await this.cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: account.value,
        UserAttributes: [{ Name: 'locale', Value: locale.name }],
      }),
    );
  }

  async setName(account: Email, name: PersonName): Promise<void> {
    await this.cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: account.value,
        UserAttributes: [{ Name: 'name', Value: name.value }],
      }),
    );
  }

  async nameOf(account: Email): Promise<string | null> {
    const found = await this.cognito.send(
      new AdminGetUserCommand({ UserPoolId: this.userPoolId, Username: account.value }),
    );
    const name = found.UserAttributes?.find((attribute) => attribute.Name === 'name')?.Value;
    return name && name.trim().length > 0 ? name : null;
  }

  /**
   * The current password is proved by AUTHENTICATING with it, because the
   * token of the interface cannot call the self-service change: its client
   * asks for `openid email profile` and nothing else, and widening it to
   * `aws.cognito.signin.user.admin` would let a stolen token change the
   * password and every attribute of the account.
   *
   * The refusal never says WHICH half failed. "That is not your password" and
   * "that password is too weak" are two facts, and telling them apart over an
   * unauthenticated retry is how a password is guessed one answer at a time.
   */
  async changePassword(
    account: Email,
    current: string,
    next: string,
  ): Promise<Result<void, DomainError>> {
    try {
      await this.cognito.send(
        new AdminInitiateAuthCommand({
          UserPoolId: this.userPoolId,
          ClientId: this.clientId,
          AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
          AuthParameters: { USERNAME: account.value, PASSWORD: current },
        }),
      );
    } catch {
      return err(DomainError.validation('The password could not be changed'));
    }

    try {
      await this.cognito.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.userPoolId,
          Username: account.value,
          Password: next,
          Permanent: true,
        }),
      );
    } catch {
      return err(DomainError.validation('The password could not be changed'));
    }

    /**
     * And every other session of the account ends at its next refresh, which
     * is what a password change means and what the screen says before it
     * happens. It runs after the change and never before: a failure here
     * leaves the person with a new password and the sessions they had, which
     * is the harmless half of the two.
     */
    await this.cognito.send(
      new AdminUserGlobalSignOutCommand({
        UserPoolId: this.userPoolId,
        Username: account.value,
      }),
    );
    return ok();
  }
}
