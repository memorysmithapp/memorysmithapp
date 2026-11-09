/**
 * The pre sign-up trigger of the user pool, on an installation that declares
 * the organization's identity provider (#395, ADR-026).
 *
 * Cognito calls it once per identity of the provider, on its first sign-in,
 * before it would create a second account for it. It links that identity to
 * the account of the same e-mail instead, creating it when the installation
 * allows (RN-ACC-039, RN-ACC-040, RN-SUB-026). Every other sign-up, an
 * account `onboard` creates included, passes untouched.
 *
 * A refusal is thrown, and Cognito hands its message back to the page the
 * sign-in started from as `PreSignUp failed with error <message>.`, which is
 * what the person reads.
 */

import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Instant } from '@memorysmithapp/kernel';
import { observe } from '@memorysmithapp/observability';
import { FederatedSignIn, type FirstSignIn } from '../../application/federation.js';
import { StorageQuota } from '../../domain/values.js';
import { CognitoFederatedAccounts } from '../outbound/cognito/CognitoFederatedAccounts.js';
import { DynamoOnboarding } from '../outbound/dynamodb/DynamoAccess.js';
import { NULL_OUTBOX_SINK } from '../outbound/dynamodb/items.js';

export interface PreSignUpEvent {
  triggerSource: string;
  userPoolId: string;
  /** `<provider>_<sub of the provider>` for an identity of a provider. */
  userName: string;
  request: { userAttributes: Record<string, string | undefined> };
  response?: unknown;
}

/** The provider and the identity a federated sign-up names, or null for any other. */
export function identityOf(
  event: Pick<PreSignUpEvent, 'triggerSource' | 'userName'>,
): { provider: string; providerUserId: string } | null {
  if (event.triggerSource !== 'PreSignUp_ExternalProvider') return null;
  // A provider is named with no underscore (IDP_NAME), so the first one ends it.
  const cut = event.userName.indexOf('_');
  if (cut <= 0 || cut === event.userName.length - 1) return null;
  return { provider: event.userName.slice(0, cut), providerUserId: event.userName.slice(cut + 1) };
}

const firstSignIn = (process.env['FIRST_SIGN_IN'] ?? 'request') as FirstSignIn;
const quota = StorageQuota.create(process.env['QUOTA'] ?? '');

let signIn: FederatedSignIn | null = null;
function federatedSignIn(userPoolId: string): FederatedSignIn {
  signIn ??= new FederatedSignIn(
    new CognitoFederatedAccounts(userPoolId, new CognitoIdentityProviderClient({})),
    new DynamoOnboarding(
      DynamoDBDocumentClient.from(new DynamoDBClient({})),
      process.env['ACCESS_TABLE'] ?? '',
      NULL_OUTBOX_SINK,
    ),
    {
      firstSignIn,
      emailClaim: process.env['EMAIL_CLAIM'] ?? 'email',
      requireVerified: process.env['REQUIRE_VERIFIED'] === 'true',
      quota: quota.ok ? quota.value : StorageQuota.DEFAULT,
    },
  );
  return signIn;
}

/** One line per sign-up, named by its trigger; never the address it carries. */
export function handler(event: PreSignUpEvent): Promise<PreSignUpEvent> {
  return observe({ operation: event.triggerSource }, () => answer(event));
}

async function answer(event: PreSignUpEvent): Promise<PreSignUpEvent> {
  const identity = identityOf(event);
  if (!identity) return event;
  const attributes = event.request.userAttributes;
  const linked = await federatedSignIn(event.userPoolId).execute({
    ...identity,
    email: attributes['email'],
    emailVerified: attributes['email_verified'],
    // The provider's name arrives in given_name, never in name, so that the
    // mapping that runs on every sign-in cannot overwrite what the person
    // typed (RN-ACC-021).
    name: attributes['given_name'],
    at: Instant.now(),
  });
  if (!linked.ok) throw new Error(linked.error.message);
  return event;
}
