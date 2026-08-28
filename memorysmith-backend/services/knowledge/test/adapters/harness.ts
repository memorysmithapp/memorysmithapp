/**
 * Harness for the adapter tests: DynamoDB Local and MinIO, the same two
 * services the CI job starts (architecture-guide.md, sections 19 and 20).
 *
 * It creates the real table shape of mv-knowledge, GSI1 and GSI2 included, and
 * a VERSIONED bucket, because without versioning there is no revision for a
 * ContentRef to point at.
 */

import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketVersioningCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Authorship,
  SubscriptionContext,
  SubscriptionId,
  type TokenClaims,
} from '@memorysmith/kernel';

export const TABLE_NAME = 'mv-knowledge-test';
export const BUCKET_NAME = 'memorysmith-content-test';

const DYNAMODB_ENDPOINT = process.env['DYNAMODB_ENDPOINT'] ?? 'http://127.0.0.1:8000';
const S3_ENDPOINT = process.env['S3_ENDPOINT'] ?? 'http://127.0.0.1:9000';

const credentials = {
  accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? 'memorysmith',
  secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? 'memorysmith-local',
};

export function dynamoClient(): DynamoDBDocumentClient {
  const client = new DynamoDBClient({
    endpoint: DYNAMODB_ENDPOINT,
    region: 'us-east-1',
    credentials,
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export function rawDynamoClient(): DynamoDBClient {
  return new DynamoDBClient({ endpoint: DYNAMODB_ENDPOINT, region: 'us-east-1', credentials });
}

export function s3Client(): S3Client {
  return new S3Client({
    endpoint: S3_ENDPOINT,
    region: 'us-east-1',
    credentials,
    forcePathStyle: true,
  });
}

/** The exact shape of mv-knowledge (architecture-guide.md, section 9.3). */
export async function createTable(): Promise<void> {
  const client = rawDynamoClient();
  const existing = await client.send(new ListTablesCommand({}));
  if (existing.TableNames?.includes(TABLE_NAME)) {
    await client.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
  }
  await client.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'GSI1PK', AttributeType: 'S' },
        { AttributeName: 'GSI1SK', AttributeType: 'S' },
        { AttributeName: 'GSI2PK', AttributeType: 'S' },
        { AttributeName: 'GSI2SK', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          // Sparse on purpose: a deleted note loses these attributes and so
          // leaves every listing without a filter anywhere (section 12.4).
          IndexName: 'GSI2',
          KeySchema: [
            { AttributeName: 'GSI2PK', KeyType: 'HASH' },
            { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    }),
  );
}

export async function createBucket(): Promise<void> {
  const client = s3Client();
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
  }
  await client.send(
    new PutBucketVersioningCommand({
      Bucket: BUCKET_NAME,
      VersioningConfiguration: { Status: 'Enabled' },
    }),
  );
}

/** A context as the authorizer would build it, from token claims. */
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

/** Whether the local dependencies are reachable, so the suite can say why. */
export async function dependenciesReachable(): Promise<boolean> {
  try {
    await rawDynamoClient().send(new ListTablesCommand({}));
    await s3Client()
      .send(new HeadBucketCommand({ Bucket: BUCKET_NAME }))
      .catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}
