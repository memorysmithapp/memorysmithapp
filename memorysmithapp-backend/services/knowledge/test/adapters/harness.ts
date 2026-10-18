/**
 * Harness for the adapter tests: the real DynamoDB and S3 of a deployed
 * environment.
 *
 * They run after a delivery of staging, against the table and
 * the bucket the environment already has, and never against an emulator: an
 * emulator agrees with the real service until the day it does not, and that day
 * used to be found in production. Every case works under a subscription of its
 * own, so the leading key isolates one run from every other run and from what
 * the environment holds (INV-01).
 *
 *   KNOWLEDGE_TABLE   the knowledge table of the environment, mv-knowledge-staging
 *   CONTENT_BUCKET    the content bucket of the environment
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import {
  Authorship,
  SubscriptionContext,
  SubscriptionId,
  type TokenClaims,
  ulid,
} from '@memorysmithapp/kernel';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`The adapter tests run against a deployed environment: set ${name}.`);
  }
  return value;
}

export const TABLE_NAME = required('KNOWLEDGE_TABLE');
export const BUCKET_NAME = required('CONTENT_BUCKET');

export function dynamoClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export function s3Client(): S3Client {
  return new S3Client({});
}

/**
 * A new subscription of an adapter case: a ULID of time zero, so its keys start
 * `s/0000000000`, which no real subscription carries. The delivery role of
 * staging may destroy a revision under that prefix and under nothing else
 * (INV-08, #321), and the case of the purge destroys what it wrote.
 */
export function adapterSubscription(): SubscriptionId {
  const minted = SubscriptionId.fromClaim(ulid(0));
  if (!minted.ok) throw new Error(minted.error.message);
  return minted.value;
}

/** A context as the authorizer would build it, from token claims, under a new subscription. */
export function contextFor(
  subscriptionId: SubscriptionId = adapterSubscription(),
  claims: Partial<TokenClaims> = {},
): SubscriptionContext {
  const built = SubscriptionContext.fromClaims({
    sub: 'user-owner',
    subscription_id: subscriptionId.value,
    subscription_status: 'active',
    ...claims,
  });
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

export function authorshipOf(context: SubscriptionContext): Authorship {
  return Authorship.byHuman(context.userId);
}
