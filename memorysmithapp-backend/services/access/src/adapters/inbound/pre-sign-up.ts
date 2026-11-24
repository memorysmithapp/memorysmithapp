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
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { bytesSupport, PICTURE_MIME_TYPES } from '@memorysmithapp/contracts';
import { Instant, SubscriptionContext } from '@memorysmithapp/kernel';
import { observe } from '@memorysmithapp/observability';
import {
  FederatedSignIn,
  type FederatedFaces,
  type FirstSignIn,
} from '../../application/federation.js';
import { StorageQuota } from '../../domain/values.js';
import { CognitoFederatedAccounts } from '../outbound/cognito/CognitoFederatedAccounts.js';
import { DynamoAvatarRepository, DynamoOnboarding } from '../outbound/dynamodb/DynamoAccess.js';
import { NULL_OUTBOX_SINK } from '../outbound/dynamodb/items.js';
import { GraphDirectoryPictures } from '../outbound/graph/GraphDirectoryPictures.js';

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

/**
 * The directory asked for a person's picture, when the provider is Microsoft
 * Entra ID and the installation named its tenant (#561), or none.
 */
function directory(): GraphDirectoryPictures | null {
  const tenant = process.env['PICTURES_TENANT'];
  const secretId = process.env['PICTURES_SECRET_ID'];
  if (!tenant || !secretId) return null;
  let secret: Promise<string> | null = null;
  return new GraphDirectoryPictures({
    tenant,
    clientId: process.env['PICTURES_CLIENT_ID'] ?? '',
    secret: () =>
      (secret ??= new SecretsManagerClient({})
        .send(new GetSecretValueCommand({ SecretId: secretId }))
        .then((found) => found.SecretString ?? '')
        // A failed read is tried again by the next sign-in, not remembered.
        .catch((error: unknown) => {
          secret = null;
          throw error;
        })),
  });
}

/**
 * The avatars of the subscription the person owns: a context built from the
 * subscription this very sign-in found or wrote, never from a request
 * (INV-01, INV-02), for the one write of their first face.
 */
function faces(db: DynamoDBDocumentClient, table: string): FederatedFaces {
  return {
    avatarsOf: (owner, subscription) => {
      const context = SubscriptionContext.fromClaims({
        sub: owner.value,
        subscription_id: subscription.value,
        subscription_status: 'active',
      });
      if (!context.ok) throw new Error(context.error.message);
      return new DynamoAvatarRepository(context.value, db, table);
    },
    directory: directory(),
    types: { accepted: PICTURE_MIME_TYPES, supports: bytesSupport },
  };
}

let signIn: FederatedSignIn | null = null;
function federatedSignIn(userPoolId: string): FederatedSignIn {
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const table = process.env['ACCESS_TABLE'] ?? '';
  signIn ??= new FederatedSignIn(
    new CognitoFederatedAccounts(userPoolId, new CognitoIdentityProviderClient({})),
    new DynamoOnboarding(db, table, NULL_OUTBOX_SINK),
    {
      firstSignIn,
      emailClaim: process.env['EMAIL_CLAIM'] ?? 'email',
      requireVerified: process.env['REQUIRE_VERIFIED'] === 'true',
      quota: quota.ok ? quota.value : StorageQuota.DEFAULT,
    },
    faces(db, table),
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
