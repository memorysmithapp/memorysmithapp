/**
 * Harness for the adapter tests: the real DynamoDB and S3 of a deployed
 * environment (architecture-guide.md, sections 19 and 20).
 *
 * They run after a delivery of staging, against the table and
 * the bucket the environment already has, and never against an emulator: an
 * emulator agrees with the real service until the day it does not, and that day
 * used to be found in production. Every case works under a subscription of its
 * own, so the leading key isolates one run from every other run and from what
 * the environment holds (rule 1).
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
} from '@memorysmith/kernel';

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

/** A context as the authorizer would build it, from token claims, under a new subscription. */
export function contextFor(
  subscriptionId: SubscriptionId = SubscriptionId.generate(),
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
