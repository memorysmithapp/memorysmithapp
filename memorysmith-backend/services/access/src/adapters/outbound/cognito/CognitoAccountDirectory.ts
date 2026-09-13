/**
 * The account as Cognito keeps it (architecture-guide.md, section 8.5).
 *
 * The language is the standard attribute `locale`, because the trigger that
 * writes the messages of the pool receives the attributes of the account with
 * every message and reads nothing else (RN-ACC-018).
 */

import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import type { AccountDirectory } from '../../../domain/ports/index.js';
import type { AccountLocale, Email } from '../../../domain/values.js';

export class CognitoAccountDirectory implements AccountDirectory {
  constructor(
    private readonly userPoolId: string,
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
}
