/**
 * The accounts of the pool, as the first federated sign-in finds, creates and
 * links them (#395, ADR-026).
 *
 * The pool signs in by e-mail, so an account is found by it as its username.
 * One that is created here has no password and is sent no message: the person
 * holds it through the identity of the provider linked to it, and never types
 * a password of MemorySmith.
 */

import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminLinkProviderForUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import { UserId } from '@memorysmithapp/kernel';
import type { FederatedAccounts, PoolAccount } from '../../../application/federation.js';
import type { Email } from '../../../domain/values.js';

const attribute = (attributes: AttributeType[] | undefined, name: string): string | undefined =>
  attributes?.find((each) => each.Name === name)?.Value;

/** The providers named in the `identities` attribute of a linked account. */
export function linkedProvidersOf(identities: string | undefined): string[] {
  if (!identities) return [];
  try {
    const parsed = JSON.parse(identities) as Array<{ providerName?: unknown }>;
    return parsed.map((each) => String(each.providerName ?? '')).filter(Boolean);
  } catch {
    return [];
  }
}

function accountOf(username: string, attributes: AttributeType[] | undefined): PoolAccount {
  const sub = attribute(attributes, 'sub');
  const user = UserId.create(sub ?? '');
  if (!user.ok) throw new Error(`The account ${username} of the pool carries no sub`);
  return {
    userId: user.value,
    username,
    name: attribute(attributes, 'name')?.trim() || null,
    linkedProviders: linkedProvidersOf(attribute(attributes, 'identities')),
  };
}

export class CognitoFederatedAccounts implements FederatedAccounts {
  constructor(
    private readonly userPoolId: string,
    private readonly cognito: CognitoIdentityProviderClient = new CognitoIdentityProviderClient({}),
  ) {}

  async find(email: Email): Promise<PoolAccount | null> {
    try {
      const found = await this.cognito.send(
        new AdminGetUserCommand({ UserPoolId: this.userPoolId, Username: email.value }),
      );
      return accountOf(found.Username ?? email.value, found.UserAttributes);
    } catch (error) {
      if ((error as { name?: string })?.name === 'UserNotFoundException') return null;
      throw error;
    }
  }

  async create(email: Email, name: string | null): Promise<PoolAccount> {
    const created = await this.cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: email.value,
        // No invitation and no password: the identity of the provider is how
        // this account is held.
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: email.value },
          // The provider vouched for it, and the installation trusts the provider.
          { Name: 'email_verified', Value: 'true' },
          ...(name ? [{ Name: 'name', Value: name }] : []),
        ],
      }),
    );
    return accountOf(created.User?.Username ?? email.value, created.User?.Attributes);
  }

  async link(account: PoolAccount, provider: string, providerUserId: string): Promise<void> {
    await this.cognito.send(
      new AdminLinkProviderForUserCommand({
        UserPoolId: this.userPoolId,
        DestinationUser: { ProviderName: 'Cognito', ProviderAttributeValue: account.username },
        SourceUser: {
          ProviderName: provider,
          ProviderAttributeName: 'Cognito_Subject',
          ProviderAttributeValue: providerUserId,
        },
      }),
    );
  }

  async setName(account: PoolAccount, name: string): Promise<void> {
    await this.cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: account.username,
        UserAttributes: [{ Name: 'name', Value: name }],
      }),
    );
  }
}
